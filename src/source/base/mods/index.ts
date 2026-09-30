// ============================================================
// 联盟杀 · Mod 统一导出
//
// Mod 回答「数值怎么算」「什么事允不允许」，
// 与 Content（这张牌做什么）、Trigger（某时机额外做什么）三分天下。
//
// 这里只放**基础包**的内容。扩展包往
// `src/source/<pack>/mods/` 加文件，再到 `core/boot/effect-setup.ts`
// 的 `collectMods()` 里登记即可。
// ============================================================

export {
  weaponRangeMod,
  rattanArmorMod,
  equipMods,
  allBaseMods,
} from './equip-mods'
