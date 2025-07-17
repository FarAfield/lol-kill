function importModule() {
  return {
    type: "hero",
    id: "Milio",
    title: "明烛",
    name: "米利欧",
    avatar: "Milio.png",
    skins: [
      { name: "default", skin: "Milio_0.jpg" },
      { name: "花仙贤者 米利欧", skin: "Milio_1.jpg" },
      { name: "青蛙雨衣 米利欧", skin: "Milio_11.jpg" },
    ],
    spells: [
      { id: "MilioP", name: "热情洋溢！", icon: "MilioP.png", description: "" },
      { id: "MilioQ", name: "火爆飞踢", icon: "MilioQ.png", description: "" },
      { id: "MilioW", name: "依依不舍", icon: "MilioW.png", description: "" },
      { id: "MilioE", name: "融融情谊", icon: "MilioE.png", description: "" },
      { id: "MilioR", name: "生生不息", icon: "MilioR.png", description: "" },
    ],
    effects: {
      MilioP: null,
      MilioQ: null,
      MilioW: null,
      MilioE: null,
      MilioR: null,
    },
  };
}
export { importModule };
