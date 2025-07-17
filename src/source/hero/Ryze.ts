function importModule() {
  return {
    type: "hero",
    id: "Ryze",
    title: "符文法师",
    name: "瑞兹",
    avatar: "Ryze.png",
    skins: [
      { name: "default", skin: "Ryze_0.jpg" },
      { name: "青年 瑞兹", skin: "Ryze_1.jpg" },
      { name: "部落精神 瑞兹", skin: "Ryze_2.jpg" },
      { name: "美国大叔 瑞兹", skin: "Ryze_3.jpg" },
      { name: "守护者雕像 瑞兹", skin: "Ryze_4.jpg" },
      { name: "宗师级法师训练师 瑞兹", skin: "Ryze_5.jpg" },
      { name: "至死不渝 瑞兹", skin: "Ryze_6.jpg" },
      { name: "恶魔男爵 瑞兹", skin: "Ryze_7.jpg" },
      { name: "海贼 瑞兹", skin: "Ryze_8.jpg" },
      { name: "瑞兹·白须", skin: "Ryze_9.jpg" },
      { name: "SKT T1 瑞兹", skin: "Ryze_10.jpg" },
      { name: "冠军之志 瑞兹", skin: "Ryze_11.jpg" },
      { name: "沙之守护 瑞兹", skin: "Ryze_13.jpg" },
      { name: "孤勇之隐 瑞兹", skin: "Ryze_20.jpg" },
    ],
    spells: [
      { id: "RyzeP", name: "奥术专精", icon: "RyzeP.png", description: "" },
      { id: "RyzeQ", name: "超负荷", icon: "RyzeQ.png", description: "" },
      { id: "RyzeW", name: "符文禁锢", icon: "RyzeW.png", description: "" },
      { id: "RyzeE", name: "法术涌动", icon: "RyzeE.png", description: "" },
      { id: "RyzeR", name: "曲境折跃", icon: "RyzeR.png", description: "" },
    ],
    effects: {
      RyzeP: null,
      RyzeQ: null,
      RyzeW: null,
      RyzeE: null,
      RyzeR: null,
    },
  };
}
export { importModule };
