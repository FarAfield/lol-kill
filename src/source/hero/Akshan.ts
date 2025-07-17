function importModule() {
  return {
    type: "hero",
    id: "Akshan",
    title: "影哨",
    name: "阿克尚",
    avatar: "Akshan.png",
    skins: [
      { name: "default", skin: "Akshan_0.jpg" },
      { name: "赛博潮流 阿克尚", skin: "Akshan_1.jpg" },
      { name: "水晶玫瑰 阿克尚", skin: "Akshan_10.jpg" },
      { name: "荣誉使者 阿克尚", skin: "Akshan_20.jpg" },
    ],
    spells: [
      { id: "AkshanP", name: "无所不用", icon: "AkshanP.png", description: "" },
      { id: "AkshanQ", name: "去而复还", icon: "AkshanQ.png", description: "" },
      { id: "AkshanW", name: "赴险夺人", icon: "AkshanW.png", description: "" },
      { id: "AkshanE", name: "骄行荡寇", icon: "AkshanE.png", description: "" },
      { id: "AkshanR", name: "恩怨相抵", icon: "AkshanR.png", description: "" },
    ],
    effects: {
      AkshanP: null,
      AkshanQ: null,
      AkshanW: null,
      AkshanE: null,
      AkshanR: null,
    },
  };
}
export { importModule };
