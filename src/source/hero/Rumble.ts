function importModule() {
  return {
    type: "hero",
    id: "Rumble",
    title: "机械公敌",
    name: "兰博",
    avatar: "Rumble.png",
    skins: [
      { name: "default", skin: "Rumble_0.jpg" },
      { name: "热带丛林 兰博", skin: "Rumble_1.jpg" },
      { name: "独眼海盗 兰博", skin: "Rumble_2.jpg" },
      { name: "银河魔装机神 兰博", skin: "Rumble_3.jpg" },
      { name: "废土男爵 兰博", skin: "Rumble_4.jpg" },
      { name: "太空律动 “串烧大师” 兰博", skin: "Rumble_13.jpg" },
      { name: "咖啡甜心 兰博", skin: "Rumble_23.jpg" },
    ],
    spells: [
      { id: "RumbleP", name: "机械重组", icon: "RumbleP.png", description: "" },
      { id: "RumbleQ", name: "纵火盛宴", icon: "RumbleQ.png", description: "" },
      { id: "RumbleW", name: "破碎护盾", icon: "RumbleW.png", description: "" },
      { id: "RumbleE", name: "电子鱼叉", icon: "RumbleE.png", description: "" },
      { id: "RumbleR", name: "恒温灼烧", icon: "RumbleR.png", description: "" },
    ],
    effects: {
      RumbleP: null,
      RumbleQ: null,
      RumbleW: null,
      RumbleE: null,
      RumbleR: null,
    },
  };
}
export { importModule };
