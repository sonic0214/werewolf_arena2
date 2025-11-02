# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Werewolf game."""

from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import random
from typing import List, Optional, Callable, Dict, Any
from datetime import datetime

import tqdm
import time

from src.core.models.game_state import Round, State
from src.core.models.logs import RoundLog, VoteLog
from src.config.settings import MAX_DEBATE_TURNS, RUN_SYNTHETIC_VOTES
from src.config.settings import settings
from src.config.timing_loader import apply_game_mode, get_delay

def get_max_bids(d):
  """Gets all the keys with the highest value in the dictionary."""
  max_value = max(d.values())
  max_keys = [key for key, value in d.items() if value == max_value]
  return max_keys


class Timer:
  """简单的计时器类，用于性能统计"""
  def __init__(self, name: str):
    self.name = name
    self.start_time = time.time()
  
  def elapsed(self) -> float:
    """返回已经过的时间（秒）"""
    return time.time() - self.start_time
  
  def log(self, message: str = ""):
    """记录当前耗时"""
    elapsed = self.elapsed()
    if message:
      tqdm.tqdm.write(f"⏱️ [{self.name}] {message}: {elapsed:.2f}秒")
    else:
      tqdm.tqdm.write(f"⏱️ [{self.name}] 耗时: {elapsed:.2f}秒")
    return elapsed


class GameMaster:

  def __init__(
      self,
      state: State,
      num_threads: int = 1,
      on_progress: Optional[Callable[[State, List[RoundLog]], None]] = None,
      game_mode: str = "normal",  # normal, fast, slow, demo
  ) -> None:
    """Initialize the Werewolf game.

    Args:
      state: 游戏状态
      num_threads: 线程数
      on_progress: 进度回调函数
      game_mode: 游戏模式，影响延迟速度
    """
    self.state = state
    self.current_round_num = len(self.state.rounds) if self.state.rounds else 0
    self.num_threads = num_threads
    self.logs: List[RoundLog] = []
    self.on_progress = on_progress
    self.should_stop = False  # 添加停止标志
    
    # 时间统计
    self.timing_stats = {
      "round_times": [],
      "phase_times": {},
      "action_times": []
    }

    # 应用游戏模式延迟倍数
    self.delay_multiplier = apply_game_mode(game_mode)
    self.game_mode = game_mode
    print(f"🎮 游戏模式: {game_mode} (延迟倍数: {self.delay_multiplier}x)")

  def _progress(self) -> None:
    if self.on_progress:
      self.on_progress(self.state, self.logs)

  @property
  def this_round(self) -> Round:
    return self.state.rounds[self.current_round_num]

  @property
  def this_round_log(self) -> RoundLog:
    return self.logs[self.current_round_num]

  def eliminate(self):
    """Werewolves choose a player to eliminate."""
    action_timer = Timer("狼人击杀")
    
    # 添加夜间行动延迟（使用配置文件）
    delay = get_delay("night_action", self.delay_multiplier)
    if delay > 0:
      tqdm.tqdm.write(f"⏱️ [夜间延迟] 暂停{delay:.2f}秒")
    time.sleep(delay)

    werewolves_alive = [
        w for w in self.state.werewolves if w.name in self.this_round.players
    ]

    if not werewolves_alive:
      raise ValueError("No werewolves alive to eliminate players.")

    wolf = random.choice(werewolves_alive)
    eliminated, log = wolf.eliminate()
    self.this_round_log.eliminate = log
    
    action_timer.log(f"狼人 {wolf.name} 行动完成")

    # 如果返回None，选择一个默认目标
    if eliminated is None:
      available_targets = [
          p for p in self.this_round.players
          if p != wolf.name and p not in [w.name for w in self.state.werewolves]
      ]
      if available_targets:
        eliminated = random.choice(available_targets)
        print(f"Warning: {wolf.name} failed to choose target, randomly selected {eliminated}")
        # 更新日志以反映随机选择
        log.result = {"remove": eliminated, "reasoning": "Random fallback selection"}
      else:
        # 如果没有有效目标，跳过淘汰
        print(f"Warning: No valid targets for {wolf.name} to eliminate")
        eliminated = None

    if eliminated is not None:
      self.this_round.eliminated = eliminated
      tqdm.tqdm.write(f"{wolf.name} eliminated {eliminated}")
      for wolf in werewolves_alive:
        wolf._add_observation(
            f"在夜晚阶段，{'我们' if len(werewolves_alive) > 1 else '我'}决定淘汰{eliminated}。"
        )

      # 发送 WebSocket 通知 - 狼人击杀行动
      self._notify_night_action(
        action_type="night_eliminate",
        player_name=wolf.name,
        player_role="Werewolf",
        target_name=eliminated,
        details={
          "action": "夜间击杀",
          "reasoning": log.result.get("reasoning", "无推理信息") if log.result else "无日志"
        }
      )
    else:
      print(f"No player was eliminated this round")

      # 发送 WebSocket 通知 - 狼人行动失败
      self._notify_night_action(
        action_type="error",
        player_name=wolf.name,
        player_role="Werewolf",
        details={
          "action": "夜间击杀失败",
          "reason": "没有有效目标"
        }
      )

    self._progress()

  def protect(self):
    """Doctor chooses a player to protect."""
    if self.state.doctor.name not in self.this_round.players:
      return  # Doctor no longer in the game

    action_timer = Timer("医生保护")
    
    # 添加夜间行动延迟（使用配置文件）
    delay = get_delay("night_action", self.delay_multiplier)
    if delay > 0:
      tqdm.tqdm.write(f"⏱️ [夜间延迟] 暂停{delay:.2f}秒")
    time.sleep(delay)

    protect, log = self.state.doctor.save()
    self.this_round_log.protect = log
    
    action_timer.log(f"医生 {self.state.doctor.name} 行动完成")

    if protect is None:
      # 如果没有返回保护目标，随机选择一个
      available_targets = list(self.this_round.players)
      if available_targets:
        protect = random.choice(available_targets)
        print(f"Warning: {self.state.doctor.name} failed to choose protection target, randomly selected {protect}")
        # 更新日志
        log.result = {"protect": protect, "reasoning": "Random fallback selection"}
      else:
        print(f"Warning: No players available for {self.state.doctor.name} to protect")
        protect = None

    if protect is not None:
      self.this_round.protected = protect
      tqdm.tqdm.write(f"{self.state.doctor.name} protected {protect}")

      # 发送 WebSocket 通知 - 医生保护行动
      self._notify_night_action(
        action_type="night_protect",
        player_name=self.state.doctor.name,
        player_role="Doctor",
        target_name=protect,
        details={
          "action": "医生保护",
          "reasoning": log.result.get("reasoning", "无推理信息") if log.result else "无日志"
        }
      )
    else:
      print(f"No player was protected this round")

      # 发送 WebSocket 通知 - 医生行动失败
      self._notify_night_action(
        action_type="error",
        player_name=self.state.doctor.name,
        player_role="Doctor",
        details={
          "action": "医生保护失败",
          "reason": "没有可保护的目标"
        }
      )

    self._progress()

  def unmask(self):
    """Seer chooses a player to unmask."""
    if self.state.seer.name not in self.this_round.players:
      return  # Seer no longer in the game

    action_timer = Timer("预言家查验")
    
    # 添加夜间行动延迟（使用配置文件）
    delay = get_delay("night_action", self.delay_multiplier)
    if delay > 0:
      tqdm.tqdm.write(f"⏱️ [夜间延迟] 暂停{delay:.2f}秒")
    time.sleep(delay)

    unmask, log = self.state.seer.unmask()
    self.this_round_log.investigate = log
    
    action_timer.log(f"预言家 {self.state.seer.name} 行动完成")

    if unmask is None:
      # 如果没有返回调查目标，随机选择一个未调查过的玩家
      available_targets = [
          p for p in self.this_round.players
          if p != self.state.seer.name and p not in self.state.seer.previously_unmasked.keys()
      ]
      if available_targets:
        unmask = random.choice(available_targets)
        print(f"Warning: {self.state.seer.name} failed to choose investigation target, randomly selected {unmask}")
        # 更新日志
        log.result = {"investigate": unmask, "reasoning": "Random fallback selection"}
      else:
        print(f"Warning: No available targets for {self.state.seer.name} to investigate")
        unmask = None

    if unmask is not None:
      self.this_round.unmasked = unmask
      target_role = self.state.players[unmask].role
      self.state.seer.reveal_and_update(unmask, target_role)

      # 发送 WebSocket 通知 - 预言家查验行动
      self._notify_night_action(
        action_type="night_investigate",
        player_name=self.state.seer.name,
        player_role="Seer",
        target_name=unmask,
        details={
          "action": "预言家查验",
          "reasoning": log.result.get("reasoning", "无推理信息") if log.result else "无日志",
          "target_role": target_role,
          "investigation_result": target_role
        }
      )
    else:
      print(f"No player was investigated this round")

      # 发送 WebSocket 通知 - 预言家行动失败
      self._notify_night_action(
        action_type="error",
        player_name=self.state.seer.name,
        player_role="Seer",
        details={
          "action": "预言家查验失败",
          "reason": "没有可查验的目标"
        }
      )

    self._progress()

  def _get_bid(self, player_name):
    """Gets the bid for a specific player."""
    player = self.state.players[player_name]
    try:
      bid, log = player.bid()
      if bid is None:
        # 如果出价为空，使用默认出价并记录警告
        print(f"Warning: {player_name} did not return a valid bid, using default")
        bid = 1
        log = f"Default bid used due to empty response"
      # 确保 bid 是数字类型
      elif isinstance(bid, str):
        try:
          bid = int(bid)
        except (ValueError, TypeError):
          print(f"Warning: {player_name} returned string bid '{bid}', using default 0")
          bid = 0
          log = f"Error: Invalid bid value '{bid}'"
      elif not isinstance(bid, int):
        try:
          bid = int(bid)
        except (ValueError, TypeError):
          print(f"Warning: {player_name} returned invalid bid type {type(bid)}, using default 0")
          bid = 0
          log = f"Error: Invalid bid type"
    except Exception as e:
      # 如果出价过程出错，使用默认出价并记录错误
      import traceback
      print(f"[竞价错误] 玩家 {player_name} 竞价失败: {e}")
      print(f"[竞价错误] 错误类型: {type(e).__name__}")
      print(f"[竞价错误] 详细调用栈:")
      traceback.print_exc()
      bid = 1
      log = f"Error: {str(e)}"

    if bid > 1:
      tqdm.tqdm.write(f"{player_name} bid: {bid}")

    # 发送竞价WebSocket通知
    self._notify_player_action(
      action_type="bid",
      player_name=player_name,
      player_role=player.role,
      details={
        "action": f"竞价: {bid}分",
        "reasoning": log
      }
    )

    return bid, log

  def get_next_speaker(self):
    """Determine the next speaker based on bids."""
    previous_speaker, previous_dialogue = (
        self.this_round.debate[-1] if self.this_round.debate else (None, None)
    )

    with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
      player_bids = {
          player_name: executor.submit(self._get_bid, player_name)
          for player_name in self.this_round.players
          if player_name != previous_speaker
      }

      bid_log = []
      bids = {}
      try:
        for player_name, bid_task in player_bids.items():
          bid, log = bid_task.result()
          bids[player_name] = bid
          bid_log.append((player_name, log))
      except TypeError as e:
        print(e)
        raise e

    self.this_round.bids.append(bids)
    self.this_round_log.bid.append(bid_log)

    potential_speakers = get_max_bids(bids)
    # Prioritize mentioned speakers if there's previous dialogue
    if previous_dialogue:
      potential_speakers.extend(
          [name for name in potential_speakers if name in previous_dialogue]
      )

    random.shuffle(potential_speakers)
    return random.choice(potential_speakers)

  def run_summaries(self):
    """Collect summaries from players after the debate."""
    
    summary_timer = Timer("玩家总结")
    tqdm.tqdm.write("⏱️ [玩家总结] 开始收集玩家总结...")

    with ThreadPoolExecutor(max_workers=self.num_threads) as executor:
      player_summaries = {
          name: executor.submit(self.state.players[name].summarize)
          for name in self.this_round.players
      }

      for player_name, summary_task in player_summaries.items():
        try:
            summary, log = summary_task.result()
            if summary is None:
                # 如果总结为空，使用默认总结并记录警告
                print(f"Warning: {player_name} did not return a valid summary, using default")
                summary = "我需要仔细思考今天发生的情况，并仔细分析局势。"
                log = f"Default summary used due to empty response"
            tqdm.tqdm.write(f"{player_name} summary: {summary}")
            self.this_round_log.summaries.append((player_name, log))
            
            # 发送总结通知
            self._notify_player_summary(player_name, summary, self.current_round_num)
        except Exception as e:
            # 如果总结过程出错，使用默认总结并记录错误
            print(f"Error during summary for {player_name}: {e}")
            summary = "我需要仔细思考今天发生的情况，并仔细分析局势。"
            log = f"Error: {str(e)}"
            tqdm.tqdm.write(f"{player_name} summary: {summary}")
            self.this_round_log.summaries.append((player_name, log))
            
            # 发送总结通知
            self._notify_player_summary(player_name, summary, self.current_round_num)

            # 添加总结延迟（使用配置文件）
            delay = get_delay("summary", self.delay_multiplier)
            if delay > 0:
              tqdm.tqdm.write(f"⏱️ [总结延迟] 暂停{delay:.2f}秒")
            time.sleep(delay)

        self._progress()
    
    summary_timer.log("玩家总结完成")

  def _generate_speech(self, speaker_name: str):
    """生成单个玩家的发言内容"""
    player = self.state.players[speaker_name]
    try:
      dialogue, log = player.debate()
      if dialogue is None:
        # 如果发言为空，使用默认发言并记录警告
        print(f"Warning: {speaker_name} did not return a valid dialogue, using default")
        dialogue = f"我需要仔细观察并寻找线索。"
        log = f"Default dialogue used due to empty response"
    except Exception as e:
      # 如果发言过程出错，使用默认发言并记录错误
      import traceback
      print(f"[辩论错误] 玩家 {speaker_name} 发言失败: {e}")
      print(f"[辩论错误] 错误类型: {type(e).__name__}")
      print(f"[辩论错误] 详细调用栈:")
      traceback.print_exc()
      dialogue = f"我需要仔细观察并寻找线索。"
      log = f"Error: {str(e)}"
    
    return dialogue, log

  def run_day_phase(self):
    """Run the day phase with concurrent speech generation but sequential delivery."""
    
    phase_timer = Timer("发言阶段")

    # 状态切换前暂停1秒
    tqdm.tqdm.write("⏱️ [阶段切换] 暂停1秒...")
    pause_timer = Timer("切换暂停")
    time.sleep(1)
    pause_timer.log("切换暂停完成")
    
    # 发送白天/发言阶段通知
    notify_timer = Timer("阶段通知")
    self._notify_phase_change(phase="debate", round_number=self.current_round_num)
    notify_timer.log("阶段通知发送")

    # 改为每个存活玩家都发言一次（打乱顺序以增加随机性）
    speakers = self.this_round.players.copy()
    random.shuffle(speakers)  # 打乱发言顺序
    
    tqdm.tqdm.write(f"本轮发言顺序: {', '.join(speakers)}")
    tqdm.tqdm.write(f"[并发生成] 使用3线程并发生成发言内容...")

    # 并发生成所有发言内容（分批处理，每批最多3个）
    speeches = {}
    speech_logs = {}
    
    generation_timer = Timer("发言生成")
    batch_size = 3  # 每批3个玩家并发
    for batch_start in range(0, len(speakers), batch_size):
      batch_speakers = speakers[batch_start:batch_start+batch_size]
      batch_num = batch_start // batch_size + 1
      total_batches = (len(speakers) + batch_size - 1) // batch_size
      
      batch_timer = Timer(f"批次{batch_num}")
      tqdm.tqdm.write(f"[批次 {batch_num}/{total_batches}] 并发生成: {', '.join(batch_speakers)}")
      
      with ThreadPoolExecutor(max_workers=3) as executor:
        # 提交任务
        futures = {
          speaker: executor.submit(self._generate_speech, speaker)
          for speaker in batch_speakers
        }
        
        # 等待这一批全部完成
        for speaker in batch_speakers:
          dialogue, log = futures[speaker].result()
          speeches[speaker] = dialogue
          speech_logs[speaker] = log
          tqdm.tqdm.write(f"  ✓ {speaker} 发言生成完成 ({len(dialogue)}字)")
      
      batch_timer.log(f"批次{batch_num}完成")
    
    generation_timer.log("所有发言生成完成")
    tqdm.tqdm.write(f"[生成完成] 所有发言已生成，开始按顺序发送和展示...")

    # 按顺序发送和处理（保证顺序）
    delivery_timer = Timer("发言发送")
    total_pause_time = 0
    
    for idx, speaker in enumerate(speakers):
      dialogue = speeches[speaker]
      log = speech_logs[speaker]
      
      send_timer = Timer(f"发送-{speaker}")
      
      # 保存到游戏状态
      self.this_round_log.debate.append((speaker, log))
      self.this_round.debate.append([speaker, dialogue])
      tqdm.tqdm.write(f"[{idx + 1}/{len(speakers)}] {speaker} ({self.state.players[speaker].role}): {dialogue}")
      
      # 发送 WebSocket 通知
      self._notify_debate_turn(
        player_name=speaker,
        dialogue=dialogue,
        player_role=self.state.players[speaker].role,
        turn_number=idx + 1
      )
      
      # 更新其他玩家的游戏状态
      for name in self.this_round.players:
        player = self.state.players[name]
        if player.gamestate:
          player.gamestate.update_debate(speaker, dialogue)
        else:
          raise ValueError(f"{name}.gamestate needs to be initialized.")
      
      self._progress()
      
      send_elapsed = send_timer.log(f"{speaker}发送完成")
      
      # 计算暂停时间：每15个字1秒，最少0.5秒
      char_count = len(dialogue)
      pause_seconds = max(0.5, char_count / 15.0)
      tqdm.tqdm.write(f"⏱️ [展示暂停] {char_count}字 → 暂停 {pause_seconds:.1f}秒")
      time.sleep(pause_seconds)
      total_pause_time += pause_seconds
    
    delivery_timer.log("所有发言发送完成")
    tqdm.tqdm.write(f"⏱️ [发言暂停汇总] 总暂停时间: {total_pause_time:.1f}秒")
    
    phase_timer.log("发言阶段总耗时")

    # 所有人发言完毕后，进入投票阶段
    if True or RUN_SYNTHETIC_VOTES:
        # 进入投票阶段
        # 状态切换前暂停1秒
        tqdm.tqdm.write("⏱️ [投票阶段] 切换暂停1秒...")
        pause_timer = Timer("投票切换")
        time.sleep(1)
        pause_timer.log("投票切换完成")
        
        # 发送投票阶段通知
        notify_timer = Timer("投票通知")
        self._notify_phase_change(phase="voting", round_number=self.current_round_num)
        notify_timer.log("投票通知发送")
        
        voting_timer = Timer("投票阶段")
        votes, vote_logs = self.run_voting()
        voting_timer.log("投票阶段完成")
        
        self.this_round.votes.append(votes)
        self.this_round_log.votes.append(vote_logs)
        self._progress()

    for player, vote in self.this_round.votes[-1].items():
      tqdm.tqdm.write(f"{player} 投票淘汰 {vote}")

  def run_voting(self):
    """Conduct a vote among players to exile someone."""
    vote_log = []
    votes = {}

    tqdm.tqdm.write("⏱️ [投票] 开始顺序处理投票（15秒超时）...")
    # 改为顺序处理投票，以便发送实时通知，添加15秒超时机制
    for player_name in self.this_round.players:
      player_timer = Timer(f"投票-{player_name}")
      player = self.state.players[player_name]

      # 使用线程池实现15秒超时机制
      with ThreadPoolExecutor(max_workers=1) as executor:
        try:
          future = executor.submit(player.vote)
          vote, log = future.result(timeout=15.0)  # 15秒超时

          if vote is None:
            # 如果没有返回投票，使用默认投票
            tqdm.tqdm.write(f"⚠️ [{player_name}] 未返回有效投票，使用默认投票")
            vote = next((p for p in self.this_round.players if p and p != player_name), player_name)
            log = f"Default vote used due to empty response"

          # 验证投票是否是有效的玩家名
          if vote not in self.this_round.players:
            tqdm.tqdm.write(f"⚠️ [{player_name}] 投票目标无效 '{vote}'，使用默认投票")
            vote = next((p for p in self.this_round.players if p and p != player_name), player_name)
            log = f"Invalid vote corrected to: {vote}"

          votes[player_name] = vote
          vote_log.append(VoteLog(player_name, vote, log))

          # 发送 WebSocket 通知 - 投票
          self._notify_vote_cast(
            voter=player_name,
            target=vote,
            voter_role=player.role
          )
          
          player_timer.log(f"{player_name}投票完成")

          # 添加投票延迟（使用配置文件）
          delay = get_delay("vote", self.delay_multiplier)
          time.sleep(delay)

        except TimeoutError:
          # 投票超时，使用默认投票
          tqdm.tqdm.write(f"⚠️ [{player_name}] 投票超时(>15秒)，使用默认投票")
          vote = next((p for p in self.this_round.players if p and p != player_name), player_name)
          log = f"Timeout: Default vote used after 15s timeout"
          votes[player_name] = vote
          vote_log.append(VoteLog(player_name, vote, log))
          
          # 发送 WebSocket 通知 - 投票
          self._notify_vote_cast(
            voter=player_name,
            target=vote,
            voter_role=player.role
          )
          
          player_timer.log(f"{player_name}投票超时，使用默认")
          
        except Exception as e:
          # 如果投票过程出错，使用默认投票并记录错误
          tqdm.tqdm.write(f"❌ [{player_name}] 投票异常: {e}")
          default_target = next((p for p in self.this_round.players if p and p != player_name), player_name)
          votes[player_name] = default_target
          vote_log.append(VoteLog(player_name, default_target, f"Error: {str(e)}"))

          # 发送 WebSocket 通知 - 投票错误
          self._notify_vote_cast(
            voter=player_name,
            target=default_target,
            voter_role=player.role
          )

    return votes, vote_log

  def exile(self):
    """Exile the player who received the most votes (relative majority)."""

    exile_timer = Timer("放逐处理")

    most_voted, vote_count = Counter(
        self.this_round.votes[-1].values()
    ).most_common(1)[0]

    # 相对多数制：得票最多的玩家直接出局（无需超过50%）
    self.this_round.exiled = most_voted

    if self.this_round.exiled is not None:
      exiled_player = self.this_round.exiled
      # 安全地从玩家列表中移除被流放的玩家
      if exiled_player in self.this_round.players:
        self.this_round.players.remove(exiled_player)
        announcement = (
            f"{exiled_player} 获得最高票数({vote_count}票)，被投票放逐。"
        )

        tqdm.tqdm.write(f"⏱️ [放逐] {exiled_player} 被投票放逐")

        # 发送放逐通知
        self._notify_player_exile(exiled_player, self.current_round_num)

        # 更新所有剩余玩家的游戏状态
        for name in self.this_round.players:
          player = self.state.players.get(name)
          if player:
            if player.gamestate:
              player.gamestate.remove_player(exiled_player)
            player.add_announcement(announcement)
      else:
        print(f"Warning: Exiled player {exiled_player} not found in players list")
        announcement = f"No valid player was exiled (target: {exiled_player})."
        # 仍然通知所有玩家
        for name in self.this_round.players:
          player = self.state.players.get(name)
          if player:
            player.add_announcement(announcement)
    else:
      announcement = "没有玩家被放逐。"
      tqdm.tqdm.write("⏱️ [放逐] 无人被放逐")
      # 通知所有玩家
      for name in self.this_round.players:
        player = self.state.players.get(name)
        if player:
          player.add_announcement(announcement)

    tqdm.tqdm.write(announcement)
    exile_timer.log("放逐处理完成")
    self._progress()

  def resolve_night_phase(self):
    """Resolve elimination and protection during the night phase."""
    if self.this_round.eliminated != self.this_round.protected:
      eliminated_player = self.this_round.eliminated

      # 安全地从玩家列表中移除被淘汰的玩家
      if eliminated_player in self.this_round.players:
        self.this_round.players.remove(eliminated_player)
        announcement = (
            f"狼人在夜晚阶段淘汰了{eliminated_player}。"
        )

        # 更新所有剩余玩家的游戏状态
        for name in self.this_round.players:
          player = self.state.players.get(name)
          if player:
            if player.gamestate:
              player.gamestate.remove_player(eliminated_player)
            player.add_announcement(announcement)
      else:
        print(f"Warning: Eliminated player {eliminated_player} not found in players list")
        announcement = f"No valid player was removed during the night (target: {eliminated_player})."
        # 仍然通知所有玩家
        for name in self.this_round.players:
          player = self.state.players.get(name)
          if player:
            player.add_announcement(announcement)

    else:
      announcement = "夜晚阶段没有人被淘汰（医生保护成功）。"
      # 保护成功时，不移除任何玩家，但需要更新游戏状态
      for name in self.this_round.players:
        player = self.state.players.get(name)
        if player:
          player.add_announcement(announcement)

    tqdm.tqdm.write(announcement)

    # 状态切换前暂停1秒
    tqdm.tqdm.write("⏱️ [天亮阶段] 切换暂停1秒...")
    time.sleep(1)

    # 发送天亮阶段通知
    self._notify_phase_change(phase="day", round_number=self.current_round_num)
    
    self._progress()

  def run_round(self):
    """Run a single round of the game."""
    round_timer = Timer(f"第{self.current_round_num}轮")
    tqdm.tqdm.write(f"\n{'='*80}")
    tqdm.tqdm.write(f"⏱️ 【第 {self.current_round_num} 轮开始】")
    tqdm.tqdm.write(f"{'='*80}\n")
    
    self.state.rounds.append(Round())
    self.logs.append(RoundLog())

    self.this_round.players = (
        list(self.state.players.keys())
        if self.current_round_num == 0
        else self.state.rounds[self.current_round_num - 1].players.copy()
    )

    # 状态切换前暂停1秒
    tqdm.tqdm.write("⏱️ [夜晚开始] 切换暂停1秒...")
    pause_timer = Timer("夜晚切换")
    time.sleep(1)
    pause_timer.log("夜晚切换完成")
    
    # 发送夜晚阶段通知
    notify_timer = Timer("夜晚通知")
    self._notify_phase_change(phase="night", round_number=self.current_round_num)
    notify_timer.log("夜晚通知发送")

    action_timers = {}
    for action, message in [
        (
            self.eliminate,
            "狼人正在选择淘汰目标。",
        ),
        (self.protect, "医生正在选择保护目标。"),
        (self.unmask, "预言家正在查验身份。"),
        (self.resolve_night_phase, "夜晚阶段解决"),
        (self.check_for_winner, "夜晚阶段后检查胜负。"),
        (self.run_day_phase, "玩家开始辩论和投票。"),
        (self.exile, "投票后放逐"),
        (self.check_for_winner, "白天阶段后检查胜负。"),
        (self.run_summaries, "玩家开始总结辩论。"),
    ]:
      if message:
        tqdm.tqdm.write(f"\n⏱️ 【{message}】")
        action_timer = Timer(message)
      
      action()
      
      if message:
        action_timers[message] = action_timer.elapsed()
        action_timer.log(f"{message}完成")
      
      # Save progress after each major action in the round
      self._progress()

      if self.state.winner:
        tqdm.tqdm.write(f"\n⏱️ 第{self.current_round_num}轮结束（游戏结束）")
        self.this_round.success = True
        round_timer.log(f"第{self.current_round_num}轮总耗时")
        self._print_round_summary(action_timers, round_timer.elapsed())
        return

    tqdm.tqdm.write(f"\n⏱️ 第{self.current_round_num}轮结束")
    self.this_round.success = True
    self._progress()
    
    total_time = round_timer.log(f"第{self.current_round_num}轮总耗时")
    self._print_round_summary(action_timers, total_time)
  
  def _print_round_summary(self, action_timers: dict, total_time: float):
    """打印本轮时间统计摘要"""
    tqdm.tqdm.write(f"\n{'='*80}")
    tqdm.tqdm.write(f"📊 【第 {self.current_round_num} 轮时间统计】")
    tqdm.tqdm.write(f"{'='*80}")
    
    for action, elapsed in action_timers.items():
      percentage = (elapsed / total_time * 100) if total_time > 0 else 0
      tqdm.tqdm.write(f"  {action:30s}: {elapsed:6.2f}秒 ({percentage:5.1f}%)")
    
    tqdm.tqdm.write(f"{'─'*80}")
    tqdm.tqdm.write(f"  {'总耗时':30s}: {total_time:6.2f}秒 (100.0%)")
    tqdm.tqdm.write(f"{'='*80}\n")

  def get_winner(self) -> str:
    """Determine the winner of the game."""
    active_wolves = set(self.this_round.players) & set(
        w.name for w in self.state.werewolves
    )
    active_villagers = set(self.this_round.players) - active_wolves
    if len(active_wolves) >= len(active_villagers):
      return "Werewolves"
    return "Villagers" if not active_wolves else ""

  def check_for_winner(self):
    """Check if there is a winner and update the state accordingly."""
    self.state.winner = self.get_winner()
    if self.state.winner:
      # 转换胜利者名称为中文
      winner_name = "狼人" if self.state.winner == "Werewolves" else "好人"
      tqdm.tqdm.write(f"获胜者是：{winner_name}！")
      
      # 发送游戏结束通知
      self._notify_game_complete(winner=self.state.winner, winner_name=winner_name)
      
      self._progress()

  def stop(self):
    """设置停止标志，让游戏优雅终止"""
    self.should_stop = True
    tqdm.tqdm.write("收到停止请求，将在完成当前轮后优雅退出。")

  def _notify_night_action(self, action_type: str, player_name: str, player_role: str, target_name: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
    """发送夜间行动 WebSocket 通知"""
    try:
      # 延迟导入避免循环依赖
      from src.services.game_manager.session_manager import _notify_night_action
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          # 从 ActionType 导入
          from src.services.game_manager.sequence_manager import ActionType
          action_type_enum = ActionType(action_type)

          loop.run_until_complete(
            _notify_night_action(
              session_id=self.state.session_id,
              action_type=action_type_enum,
              player_name=player_name,
              player_role=player_role,
              target_name=target_name,
              details=details
            )
          )
          print(f"[WebSocket] 夜间行动通知已发送: {action_type} by {player_name}")
        except Exception as e:
          print(f"[WebSocket错误] 夜间行动通知发送失败: {e}")
        finally:
          loop.close()

      # 在线程池中运行异步函数，并等待完成
      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      # 等待最多1秒，确保消息发送完成
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 夜间行动通知发送超时")
      except Exception as e:
        print(f"[WebSocket错误] 夜间行动通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 夜间行动通知失败: {e}")

  def _notify_player_action(self, action_type: str, player_name: str, player_role: str, target_name: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
    """发送玩家行动 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_player_action
      from src.services.game_manager.sequence_manager import ActionType
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          action_type_enum = ActionType(action_type)
          loop.run_until_complete(
            _notify_player_action(
              session_id=self.state.session_id,
              action_type=action_type_enum,
              player_name=player_name,
              player_role=player_role,
              target_name=target_name,
              details=details
            )
          )
          print(f"[WebSocket] 玩家行动通知已发送: {action_type} by {player_name}")
        except Exception as e:
          print(f"[WebSocket错误] 玩家行动通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 玩家行动通知发送超时")
      except Exception as e:
        print(f"[WebSocket错误] 玩家行动通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 玩家行动通知失败: {e}")

  def _notify_debate_turn(self, player_name: str, dialogue: str, player_role: str, turn_number: int):
    """发送辩论发言 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_debate_turn
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          loop.run_until_complete(
            _notify_debate_turn(
              session_id=self.state.session_id,
              player_name=player_name,
              dialogue=dialogue,
              player_role=player_role
            )
          )
          print(f"[WebSocket] 辩论发言通知已发送: {player_name}")
        except Exception as e:
          print(f"[WebSocket错误] 辩论发言通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 辩论发言通知发送超时")
      except Exception as e:
        print(f"[WebSocket错误] 辩论发言通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 辩论发言通知失败: {e}")

  def _notify_vote_cast(self, voter: str, target: str, voter_role: str):
    """发送投票 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_vote_cast
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          loop.run_until_complete(
            _notify_vote_cast(
              session_id=self.state.session_id,
              voter=voter,
              target=target,
              voter_role=voter_role
            )
          )
          print(f"[WebSocket] 投票通知已发送: {voter} -> {target}")
        except Exception as e:
          print(f"[WebSocket错误] 投票通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 投票通知发送超时")
      except Exception as e:
        print(f"[WebSocket错误] 投票通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 投票通知失败: {e}")

  def _notify_phase_change(self, phase: str, round_number: int):
    """发送阶段变更 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_phase_change
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          loop.run_until_complete(
            _notify_phase_change(
              session_id=self.state.session_id,
              phase=phase,
              round_number=round_number
            )
          )
          print(f"[WebSocket] 阶段变更通知已发送: {phase} (第{round_number}轮)")
        except Exception as e:
          print(f"[WebSocket错误] 阶段变更通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 阶段变更通知发送超时: {phase}")
      except Exception as e:
        print(f"[WebSocket错误] 阶段变更通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 阶段变更通知失败: {e}")

  def _notify_player_exile(self, exiled_player: str, round_number: int):
    """发送玩家放逐 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_player_exile
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          loop.run_until_complete(
            _notify_player_exile(
              session_id=self.state.session_id,
              exiled_player=exiled_player,
              round_number=round_number
            )
          )
          print(f"[WebSocket] 玩家放逐通知已发送: {exiled_player} (第{round_number}轮)")
        except Exception as e:
          print(f"[WebSocket错误] 玩家放逐通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 玩家放逐通知发送超时: {exiled_player}")
      except Exception as e:
        print(f"[WebSocket错误] 玩家放逐通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 玩家放逐通知失败: {e}")

  def _notify_player_summary(self, player_name: str, summary: str, round_number: int):
    """发送玩家总结 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_player_summary
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          loop.run_until_complete(
            _notify_player_summary(
              session_id=self.state.session_id,
              player_name=player_name,
              summary=summary,
              round_number=round_number
            )
          )
          print(f"[WebSocket] 玩家总结通知已发送: {player_name}")
        except Exception as e:
          print(f"[WebSocket错误] 玩家总结通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 玩家总结通知发送超时: {player_name}")
      except Exception as e:
        print(f"[WebSocket错误] 玩家总结通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 玩家总结通知失败: {e}")

  def _notify_game_complete(self, winner: str, winner_name: str):
    """发送游戏结束 WebSocket 通知"""
    try:
      from src.services.game_manager.session_manager import _notify_game_complete
      import asyncio

      def run_async():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
          # 收集所有玩家的信息（包括身份）
          players_info = {}
          for player_name, player in self.state.players.items():
            players_info[player_name] = {
              "role": player.role,
              "alive": player_name in self.this_round.players
            }
          
          loop.run_until_complete(
            _notify_game_complete(
              session_id=self.state.session_id,
              winner=winner,
              winner_name=winner_name,
              players_info=players_info,
              round_number=self.current_round_num
            )
          )
          print(f"[WebSocket] 游戏结束通知已发送: {winner_name} 获胜")
        except Exception as e:
          print(f"[WebSocket错误] 游戏结束通知发送失败: {e}")
        finally:
          loop.close()

      import concurrent.futures
      executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
      future = executor.submit(run_async)
      try:
        future.result(timeout=1.0)
      except concurrent.futures.TimeoutError:
        print(f"[WebSocket警告] 游戏结束通知发送超时")
      except Exception as e:
        print(f"[WebSocket错误] 游戏结束通知异常: {e}")
      finally:
        executor.shutdown(wait=True)  # 等待任务完成后再关闭

    except Exception as e:
      print(f"[WebSocket错误] 游戏结束通知失败: {e}")

  def run_game(self) -> str:
    """Run the entire Werewolf game and return the winner."""
    while not self.state.winner and not self.should_stop:
      tqdm.tqdm.write(f"STARTING ROUND: {self.current_round_num}")
      self.run_round()

      # 检查是否在轮次之间收到停止信号
      if self.should_stop:
        tqdm.tqdm.write("游戏在轮次之间被用户停止。")
        self.state.winner = "Game Stopped"
        break

      for name in self.this_round.players:
        if self.state.players[name].gamestate:
          self.state.players[name].gamestate.round_number = (
              self.current_round_num + 1
          )
          self.state.players[name].gamestate.clear_debate()
      self.current_round_num += 1

    if self.should_stop:
      tqdm.tqdm.write("游戏被用户停止！")
    else:
      tqdm.tqdm.write("游戏结束！")
    return self.state.winner
