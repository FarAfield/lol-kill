function importModule() {
  return {
    type: "hero",
    id: "Zoe",
    title: "暮光星灵",
    name: "佐伊",
    avatar: "Zoe.png",
    skins: [
      { name: "default", skin: "Zoe_0.jpg" },
      { name: "赛博潮流 佐伊", skin: "Zoe_1.jpg" },
      { name: "泳池派对 佐伊", skin: "Zoe_2.jpg" },
      { name: "星之守护者 佐伊", skin: "Zoe_9.jpg" },
      { name: "奥术师 佐伊", skin: "Zoe_18.jpg" },
      { name: "至臻 奥术师 佐伊", skin: "Zoe_19.jpg" },
      { name: "EDG 佐伊", skin: "Zoe_20.jpg" },
      { name: "北极星守望者 佐伊", skin: "Zoe_22.jpg" },
      { name: "暗星 佐伊", skin: "Zoe_33.jpg" },
    ],
    spells: [
      { id: "ZoeP", name: "烟火四射！", icon: "ZoeP.png", description: "" },
      { id: "ZoeQ", name: "飞星乱入！", icon: "ZoeQ.png", description: "" },
      { id: "ZoeW", name: "窃法巧手", icon: "ZoeW.png", description: "" },
      { id: "ZoeE", name: "催眠气泡", icon: "ZoeE.png", description: "" },
      { id: "ZoeR", name: "折返跃迁", icon: "ZoeR.png", description: "" },
    ],
    effects: { ZoeP: null, ZoeQ: null, ZoeW: null, ZoeE: null, ZoeR: null },
  };
}
export { importModule };
