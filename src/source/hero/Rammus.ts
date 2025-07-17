function importModule() {
  return {
    type: "hero",
    id: "Rammus",
    title: "披甲龙龟",
    name: "拉莫斯",
    avatar: "Rammus.png",
    skins: [
      { name: "default", skin: "Rammus_0.jpg" },
      { name: "国王 拉莫斯", skin: "Rammus_1.jpg" },
      { name: "铬金铠甲 拉莫斯", skin: "Rammus_2.jpg" },
      { name: "熔火之心 拉莫斯", skin: "Rammus_3.jpg" },
      { name: "极度深寒 拉莫斯", skin: "Rammus_4.jpg" },
      { name: "忍龟 拉莫斯", skin: "Rammus_5.jpg" },
      { name: "全金属狂潮 拉莫斯", skin: "Rammus_6.jpg" },
      { name: "沙之守护 拉莫斯", skin: "Rammus_7.jpg" },
      { name: "制胜金球 拉莫斯", skin: "Rammus_8.jpg" },
      { name: "海克斯科技 拉莫斯", skin: "Rammus_16.jpg" },
      { name: "宇航员 拉莫斯", skin: "Rammus_17.jpg" },
      { name: "榴莲龙龟 拉莫斯", skin: "Rammus_26.jpg" },
    ],
    spells: [
      { id: "RammusP", name: "锥刺甲壳", icon: "RammusP.png", description: "" },
      { id: "RammusQ", name: "动力冲刺", icon: "RammusQ.png", description: "" },
      { id: "RammusW", name: "尖刺防御", icon: "RammusW.png", description: "" },
      { id: "RammusE", name: "狂乱嘲讽", icon: "RammusE.png", description: "" },
      { id: "RammusR", name: "冲天猛撞", icon: "RammusR.png", description: "" },
    ],
    effects: {
      RammusP: null,
      RammusQ: null,
      RammusW: null,
      RammusE: null,
      RammusR: null,
    },
  };
}
export { importModule };
