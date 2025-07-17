function importModule() {
  return {
    type: "hero",
    id: "Viego",
    title: "破败之王",
    name: "佛耶戈",
    avatar: "Viego.png",
    skins: [
      { name: "default", skin: "Viego_0.jpg" },
      { name: "福牛守护者 佛耶戈", skin: "Viego_1.jpg" },
      { name: "五杀摇滚之噪音 佛耶戈", skin: "Viego_10.jpg" },
      { name: "EDG 佛耶戈", skin: "Viego_19.jpg" },
      { name: "国王 佛耶戈", skin: "Viego_21.jpg" },
      { name: "斗魂觉醒 佛耶戈", skin: "Viego_30.jpg" },
      { name: "2024 全球总决赛 佛耶戈", skin: "Viego_37.jpg" },
    ],
    spells: [
      { id: "ViegoP", name: "君命已决", icon: "ViegoP.png", description: "" },
      { id: "ViegoQ", name: "破败王剑", icon: "ViegoQ.png", description: "" },
      { id: "ViegoW", name: "千载幽咽", icon: "ViegoW.png", description: "" },
      { id: "ViegoE", name: "茫茫焦土", icon: "ViegoE.png", description: "" },
      { id: "ViegoR", name: "痛贯天灵", icon: "ViegoR.png", description: "" },
    ],
    effects: {
      ViegoP: null,
      ViegoQ: null,
      ViegoW: null,
      ViegoE: null,
      ViegoR: null,
    },
  };
}
export { importModule };
