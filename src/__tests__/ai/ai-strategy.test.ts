// ============================================================
// Phase 26 验收 · AI 适配新契约
//
// 本组盯的是三件事（欠账 D19 / D20 / D21），它们的**症状**各不相同，
// 但根子是同一个：AI 在引擎之外自己另算了一遍答案。
//
// 1. **出牌阶段用不上视作**（D20）：出牌选项里早就有虚拟牌
//    （`PhaseManager.getPlayableCards` 把 `viewsToCards` 混进去了），
//    但策略只翻 `player.handCards` —— 虚拟牌压根不在那个数组里，
//    于是【武圣】把红牌当杀、【丈八蛇矛】把两张手牌当杀，AI 一张都用不上。
// 2. **看不见对手身上的 Mod**（D19）：评估「这一刀值不值」时按牌面值
//    想当然，藤甲挨火杀是 2 点血它当成 1 点。
// 3. **`ai.order` / `threaten` / `expose` 契约在、读取方不在**（D21）。
//
// ── 一条容易踩空的约定 ──
// 断言「AI 挑了什么」时，随机源必须是**会洗牌**的；但本组断言的多是
// 「第一优先级的分支」，随机只用于打破同分平手，因此用
// `IdentityRandomService`（原序）反而更容易复现——**不要**反过来用
// 原序随机源去断言「随机挑到了谁」，那是句废话。
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest'

import { CardType, EquipSlot, GamePhase, RoleType, ZoneType } from '@core/contracts/enums'
import { CardTag } from '@core/contracts/card-tag'
import { CardSuit } from '@core/contracts/enums'
import type { ICard } from '@core/contracts/card.interface'
import type { IPlayer } from '@core/contracts/player.interface'
import type { ISkill } from '@core/contracts/skill.interface'
import type { CardPlayOption } from '@core/contracts/services.interface'
import type { GameStateSnapshot } from '@core/contracts/game.interface'
import { AIDifficulty } from '@core/contracts/ai.interface'
import { AIController } from '@core/services/ai-controller'
import { createAIStrategy, HardAIStrategy } from '@core/services/ai-strategies'
import { TargetSystem } from '@core/system/target-system'
import { wusheng, longdan } from '@source/heroes/skills/shu-skills'
import {
  IdentityRandomService,
  cardDef,
  createTestEnv,
  giveCard,
  type TestEnv,
} from '../helpers/game-env'

let env: TestEnv

beforeEach(async () => {
  env = await createTestEnv()
  for (const player of env.players()) player.handCards.length = 0
})

// ── 装配 ──

/**
 * 把一条技能挂到指定玩家身上（走真实台账）
 *
 * 标准局启动时已经把 `source/` 全部技能登记过了，重复登记会抛错；
 * 这里按「没登记过才登记」处理。
 */
function attach(def: ISkill, player: IPlayer): void {
  const registry = env.engine.skillRegistry
  if (!registry.get(def.id)) registry.register(def)
  registry.attach(player, def.id)
}

/**
 * 装一个接了引擎查询口的 AIController
 *
 * 与 `ReplayEngine.attachAI` 同一套路：玩家 `init()` 之后才存在，
 * 因此注册与补注入只能发生在 `boot()` 之后。少了 `setCardBudget` /
 * `setModQuery` 那两步，AI 会用「出生那天」的空查询口思考——
 * 也就是 D8 / D19 当时那个症状。
 */
async function aiController(difficulty: AIDifficulty): Promise<AIController> {
  const ai = new AIController({
    defaultDifficulty: difficulty,
    minDelay: 0,
    maxDelay: 0,
    logEnabled: false,
    randomService: new IdentityRandomService(),
  })
  ai.setStateAccessor(() => env.engine.state as unknown as GameStateSnapshot)
  ai.registerPlayers(env.players().map((p) => p.id))
  ai.setCardBudget(env.engine.cardBudget)
  ai.setModQuery(env.engine.modQuery)
  ai.setSkillRegistry(env.engine.skillRegistry)
  return ai
}

/**
 * 出牌阶段此刻的选项 —— 与引擎给 AI 的**同一份**
 *
 * 取的是 `PhaseManager.getPlayableCards`（私有）与 `TargetSystem`，
 * 也就是引擎自己算候选的那一条路。测试另写一份「我觉得能打什么」
 * 就会变成第二个答案，那就守不住任何东西。
 */
function optionsFor(player: IPlayer): CardPlayOption[] {
  const pm = env.engine.phaseManager as unknown as {
    getPlayableCards(p: IPlayer, used: Map<string, number>): ICard[]
  }
  return pm.getPlayableCards(player, new Map()).map((card) => ({
    card,
    validTargets: TargetSystem.getAvailableTargets(
      player,
      card,
      env.engine.state,
      env.engine.modQuery,
    ),
    minTargets: TargetSystem.getMinTargets(card),
    maxTargets: TargetSystem.getMaxTargets(card, player, env.engine.modQuery),
  }))
}

const state = (): GameStateSnapshot => env.engine.state as unknown as GameStateSnapshot

/** 一张红色非杀的牌（武圣的原料） */
function redFiller(player: IPlayer): ICard {
  return giveCard(player, cardDef('redFiller', [], { suit: CardSuit.Heart, name: '红牌' }))
}

/** 一张真杀 */
function strikeCard(player: IPlayer): ICard {
  return giveCard(player, cardDef('sha', [CardTag.Strike, CardTag.Attack], { name: '杀' }))
}

/**
 * 把 0 号位设成主公、1 号位设成反贼
 *
 * 不写死身份的话「谁是敌人」随发牌漂移，
 * 「AI 挑了谁」就成了掷骰子。
 */
function lordVsRebel(): { lord: IPlayer; rebel: IPlayer } {
  const [lord, rebel, ...rest] = env.players()
  const roles = env.engine.playerSystem
  roles.setRole(lord!, RoleType.Aspect)
  roles.setRole(rebel!, RoleType.Ascended)
  // 其余全部设为忠臣：**主公眼里只有一个敌人**。
  // 不写死的话「AI 挑了谁」里混着威胁度、装备、马匹，
  // 而多数用例要量的只是「挑了哪张牌」。
  for (const p of rest) roles.setRole(p, RoleType.Guardian)
  return { lord: lord!, rebel: rebel! }
}

// ═══════════════════════════════════════════
// D20 · AI 在出牌阶段用得上 viewAs
// ═══════════════════════════════════════════

describe('D20 · AI 在出牌阶段用得上视作', () => {
  it('手里没有真杀、但红牌能当杀 —— AI 会挑那张虚拟杀', async () => {
    const { lord, rebel } = lordVsRebel()
    attach(wusheng, lord)
    redFiller(lord)

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, optionsFor(lord))

    expect(result).not.toBeNull()
    // 关键断言：挑中的是一张**虚拟**牌。此前 AI 只翻 `handCards`，
    // 虚拟牌不在那儿，于是这一手只能是 null（白白放弃整个出牌阶段）。
    expect(result!.card.virtual).toBe(true)
    expect(result!.card.tags.has(CardTag.Strike)).toBe(true)
    expect(result!.targets).toEqual([rebel])
  })

  it('不把候选递给策略 → AI 只能翻手牌 → 挑不到虚拟牌（这条就是接线前的症状）', () => {
    const { lord } = lordVsRebel()
    attach(wusheng, lord)
    redFiller(lord)

    // 引擎不递候选时，策略退回「翻手牌」——虚拟牌不在 `handCards` 里，
    // 于是这一手只能是 null。这条断言守的是「接线还在」，
    // 而不只是「AI 今天挑对了」。
    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    expect(strategy.chooseCardToPlay(lord, state())).toBeNull()
  })

  it('对照：不挂视作技能，同一手牌 AI 挑不出杀来', async () => {
    const { lord } = lordVsRebel()
    redFiller(lord)

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, optionsFor(lord))

    // 一张红牌既不是杀也不是装备/锦囊，出牌阶段无事可做。
    // 少了这条对照，「AI 返回了点什么」并不能证明它是**因为视作**才挑中的。
    expect(result === null || !result.card.tags.has(CardTag.Strike)).toBe(true)
  })

  it('有真杀时优先用真杀 —— 虚拟牌排在候选后面', async () => {
    const { lord, rebel } = lordVsRebel()
    attach(wusheng, lord)
    redFiller(lord)
    const real = strikeCard(lord)

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, optionsFor(lord))

    expect(result!.card.instanceId).toBe(real.instanceId)
    expect(result!.card.virtual).toBe(false)
    expect(result!.targets).toEqual([rebel])
  })

  it('端到端：跑完出牌阶段，底牌真的被消耗掉了', async () => {
    const { lord, rebel } = lordVsRebel()
    attach(wusheng, lord)
    const base = redFiller(lord)

    const ai = await aiController(AIDifficulty.Hard)
    env.engine.phaseManager.setDecisionService(ai)

    // 走真实出牌阶段：候选、目标校验、事件分发、底牌回收全都在里面
    await env.engine.phaseManager.executePhase(GamePhase.PhaseUse, lord)

    // 虚拟牌是视图，真正被用掉的是底牌
    expect(lord.handCards).not.toContain(base)
    expect(base.zone).not.toBe(ZoneType.Hand)
    // 反贼挨了一刀
    expect(rebel.hp).toBeLessThan(rebel.maxHp)
  })

  it('响应窗口本来就通 —— 候选里有虚拟闪时 AI 会出它', async () => {
    const { lord } = lordVsRebel()
    attach(longdan, lord)
    const strike = strikeCard(lord)

    // 【龙胆】：杀当闪。这一条此前已经是通的——内容层把 `cardViews`
    // 混进了响应候选，AI 按 tag 找就能命中，与出牌阶段是两条路。
    const views = env.engine.viewAs.getViews({
      player: lord,
      usage: 'response',
      requireTag: CardTag.Dodge,
    })
    expect(views.length).toBeGreaterThan(0)

    // 手牌得够三张：困难 AI 有一条「手牌只剩一张时把闪留到更关键的时刻」，
    // 那是**另一条**规则，不该被这条用例顺带推翻。
    giveCard(lord, cardDef('filler1', []))
    giveCard(lord, cardDef('filler2', []))

    const strategy = new HardAIStrategy(new IdentityRandomService())
    const chosen = strategy.respondToDefend(lord, [strike, views[0]!.card], state())

    expect(chosen?.virtual).toBe(true)
    expect(chosen?.tags.has(CardTag.Dodge)).toBe(true)
  })
})

// ═══════════════════════════════════════════
// D19 · AI 看得见对手身上的 Mod
// ═══════════════════════════════════════════

/** 一张火杀（带 `Fire` tag，藤甲吃到它是 2 点） */
function fireStrike(player: IPlayer): ICard {
  return giveCard(
    player,
    cardDef('huoSha', [CardTag.Strike, CardTag.Attack, CardTag.Fire], { name: '火杀' }),
  )
}

/** 给某人穿上藤甲（装备进防具槽） */
function equipRattanArmor(player: IPlayer): ICard {
  const armor = cardDef('tengJia', [CardTag.Equip, CardTag.RattanArmor], {
    name: '藤甲',
    type: CardType.Equip,
    equipSlot: EquipSlot.Armor,
  })
  const card = giveCard(player, armor)
  player.equipCards.push(card)
  card.zone = ZoneType.Equip
  return card
}

describe('D19 · AI 感知对手的 Mod', () => {
  it('穿藤甲的人 → AI 会挑火杀去打他，而不是随便一张杀', async () => {
    const { lord, rebel } = lordVsRebel()
    const plain = strikeCard(lord)
    const fire = fireStrike(lord)
    // 顺序是「普通杀在前」——若 AI 只是摸到哪张用哪张，就会挑这张
    expect(lord.handCards[0]!.instanceId).toBe(plain.instanceId)

    equipRattanArmor(rebel)

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, optionsFor(lord))

    expect(result!.card.instanceId).toBe(fire.instanceId)
    expect(result!.targets).toEqual([rebel])
  })

  it('对照：同一个人没穿藤甲时，火杀与普通杀等价 —— AI 不挑火杀', async () => {
    const { lord, rebel } = lordVsRebel()
    const plain = strikeCard(lord)
    fireStrike(lord)

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, optionsFor(lord))

    // 伤害一样（都是 1），于是按候选顺序取第一张（普通杀）。
    // 少了这条，「AI 挑了火杀」可能只是它碰巧排在第一位。
    expect(result!.card.instanceId).toBe(plain.instanceId)
    expect(result!.targets).toEqual([rebel])
  })

  it('没注入 Mod 查询口 → 藤甲在 AI 眼里不存在（这条就是接线前的症状）', async () => {
    const { lord, rebel } = lordVsRebel()
    const plain = strikeCard(lord)
    fireStrike(lord)
    equipRattanArmor(rebel)

    // 只给 budget、不给 modQuery：AI 按牌面值算，看不出火杀更值
    const blind = new AIController({
      defaultDifficulty: AIDifficulty.Hard,
      minDelay: 0,
      maxDelay: 0,
      logEnabled: false,
      randomService: new IdentityRandomService(),
    })
    blind.setStateAccessor(() => env.engine.state as unknown as GameStateSnapshot)
    blind.registerPlayers(env.players().map((p) => p.id))
    blind.setCardBudget(env.engine.cardBudget)

    const result = await blind.askForCardPlay(lord, optionsFor(lord))
    expect(result!.card.instanceId).toBe(plain.instanceId)
  })
})

// ═══════════════════════════════════════════
// D21 · ai.order / ai.result / threaten / expose
// ═══════════════════════════════════════════

let skillSeq = 0

/** 造一条只带 AI 元数据的临时技能 */
function skillWith(ai: ISkill['ai'], extra: Partial<ISkill> = {}): ISkill {
  skillSeq += 1
  return {
    id: `test-ai-skill-${skillSeq}`,
    name: `测试技${skillSeq}`,
    description: '',
    enable: [GamePhase.PhaseUse],
    ai,
    ...extra,
  }
}

describe('D21 · ai.order / ai.result / threaten / expose', () => {
  it('ai.order：数字大的先被考虑 —— 即使它的估值更低', () => {
    const { lord } = lordVsRebel()
    const highOrder = skillWith({ order: 9 })
    const lowOrder = skillWith({ order: 1, result: { player: () => 99 } })

    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    const chosen = strategy.chooseEffectToUse(lord, [lowOrder, highOrder], state())

    // `ai.order` 是「AI 脑子里先盘算谁」，不是 `priority`（结算顺序）。
    // 两者混用的话，调 AI 手感的人会无意中改动引擎的结算先后。
    expect(chosen?.id).toBe(highOrder.id)
  })

  it('threaten：身上带威胁技的人会被优先攻击', async () => {
    const { lord } = lordVsRebel()
    const [a, b] = [env.players()[1]!, env.players()[2]!]
    env.engine.playerSystem.setRole(a, RoleType.Ascended)
    env.engine.playerSystem.setRole(b, RoleType.Ascended)
    strikeCard(lord)

    // 只给 b 挂一条威胁技；两人其余条件（体力 / 手牌 / 装备 / 身份）全同
    attach(skillWith({ order: 0, threaten: 10 }), b)

    const ai = await aiController(AIDifficulty.Hard)
    // 手工把两人都放进合法目标，绕开距离——这里要量的是威胁度，不是距离
    const options: CardPlayOption[] = [
      {
        card: lord.handCards[0]!,
        validTargets: [a, b],
        minTargets: 1,
        maxTargets: 1,
      },
    ]
    const result = await ai.askForCardPlay(lord, options)

    expect(result!.targets).toEqual([b])

    // 对照：威胁技挪到 a 身上，答案必须跟着换
    env.engine.skillRegistry.detach(b, `test-ai-skill-${skillSeq}`)
    attach(skillWith({ order: 0, threaten: 10 }), a)
    const again = await ai.askForCardPlay(lord, options)
    expect(again!.targets).toEqual([a])
  })

  it('ai.result.target：技能对「给谁」也有发言权', () => {
    const { lord } = lordVsRebel()
    const wounded = env.players()[1]!
    const healthy = env.players()[2]!
    env.engine.playerSystem.loseHp(wounded, wounded.hp - 1)

    // 这条技能明说「给受伤的人更值」
    const skill = skillWith({
      order: 0,
      result: { target: (_p, t) => (t.isWounded ? 50 : 0) },
    })

    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    const picked = strategy.chooseEffectTargets(lord, skill, [healthy, wounded], state())

    expect(picked[0]?.id).toBe(wounded.id)
  })

  it('expose：身份没亮的人不愿发动会自报家门的技能', () => {
    // 用反贼当决策者——主公的身份开局就是公开的，藏不了，
    // 拿它测「要不要暴露」等于什么都没测。
    const { rebel } = lordVsRebel()
    // 估值 1 分，暴露代价 2 分 → 净负 → 不划算
    const loud = skillWith({ order: 0, expose: 2, result: { player: () => 1 } })

    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    expect(rebel.roleRevealed).toBe(false)
    expect(strategy.chooseEffectToUse(rebel, [loud], state())).toBeNull()

    // 对照：身份已经亮了，藏也没得藏 → 该发动还是发动
    env.engine.playerSystem.revealRole(rebel)
    expect(strategy.chooseEffectToUse(rebel, [loud], state())?.id).toBe(loud.id)
  })

  it('expose：代价高但收益更高的技能仍然会发动', () => {
    const { lord } = lordVsRebel()
    // 估值 10，暴露代价 2 → 净 8，划算
    const worthIt = skillWith({ order: 0, expose: 2, result: { player: () => 10 } })

    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    expect(strategy.chooseEffectToUse(lord, [worthIt], state())?.id).toBe(worthIt.id)
  })

  it('门槛是「够不够本」而不是「有没有写过 ai」—— 普通技能照旧发动', () => {
    const { lord } = lordVsRebel()
    // 没写 `ai.result`：估值退回 `priority`（0 分），照样该发动
    const plain = skillWith({ order: 0 })

    const strategy = createAIStrategy(AIDifficulty.Hard, new IdentityRandomService())
    expect(strategy.chooseEffectToUse(lord, [plain], state())?.id).toBe(plain.id)
  })
})

// ═══════════════════════════════════════════
// D20 的边界：合法目标 —— 挑不着的人就不该挑
// ═══════════════════════════════════════════

describe('AI 只在引擎给的合法目标里挑', () => {
  it('够不着的人不会被挑中 —— 出牌不会因「目标不足」作废', async () => {
    const { lord } = lordVsRebel()
    strikeCard(lord)

    // 只给一个**够不着**的目标（4 号位，座次距离远超 1）。
    // 它得是个敌人，否则「没有敌人可打」与「够不着」会混成一件事。
    const unreachable = env.players()[4]!
    env.engine.playerSystem.setRole(unreachable, RoleType.Ascended)
    const options: CardPlayOption[] = [
      {
        card: lord.handCards[0]!,
        validTargets: [unreachable],
        minTargets: 1,
        maxTargets: 1,
      },
    ]

    const ai = await aiController(AIDifficulty.Hard)
    const result = await ai.askForCardPlay(lord, options)

    // 旧实现的症状：策略从全场挑人 → 挑中够不着的 → 过滤后目标不足
    // → `askForCardPlay` 返回 null → **整个出牌阶段被白白放弃**。
    expect(result).not.toBeNull()
    expect(result!.targets).toEqual([unreachable])
  })
})
