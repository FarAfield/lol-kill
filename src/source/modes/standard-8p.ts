// ============================================================
// 联盟杀 · 标准8人局模式配置
//
// 身份分布：1 Aspect + 2 Guardian + 4 Ascended + 1 Infiltrator
//           （1 主公 + 2 忠臣 + 4 反贼 + 1 内奸）
// ============================================================

import { RoleType } from '@core/contracts/enums'
import type { IGameConfig } from '@core/contracts/game.interface'
import { standardHeroes } from '@source/heroes/standard'
import { basicCards } from '@source/cards/basic'
import { trickCards } from '@source/cards/tricks'
import { equipCards } from '@source/cards/equips'

/**
 * 标准8人局配置
 */
export const standard8pConfig: IGameConfig = {
  mode: 'standard-8p',
  playerCount: 8,
  roles: [
    RoleType.Aspect,
    RoleType.Guardian,
    RoleType.Guardian,
    RoleType.Ascended,
    RoleType.Ascended,
    RoleType.Ascended,
    RoleType.Ascended,
    RoleType.Infiltrator,
  ],
  heroes: standardHeroes,
  cards: [...basicCards, ...trickCards, ...equipCards],
  heroSelectCount: 3,
  initialHandSize: 4,
  equipEnabled: true,
  delayedCardEnabled: true,
  maxRounds: 100,
}
