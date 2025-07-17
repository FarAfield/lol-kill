function importModule() {
  return {
    type: "hero",
    id: "Renata",
    title: "炼金男爵",
    name: "烈娜塔 · 戈拉斯克",
    avatar: "Renata.png",
    skins: [
      { name: "default", skin: "Renata_0.jpg" },
      { name: "舰队司令 烈娜塔", skin: "Renata_1.jpg" },
      { name: "魔域梦魇 烈娜塔", skin: "Renata_10.jpg" },
      { name: "魂蔷薇 烈娜塔", skin: "Renata_20.jpg" },
      { name: "至臻 魂蔷薇 烈娜塔", skin: "Renata_21.jpg" },
    ],
    spells: [
      { id: "RenataP", name: "物尽其用", icon: "RenataP.png", description: "" },
      { id: "RenataQ", name: "铁腕竞合", icon: "RenataQ.png", description: "" },
      { id: "RenataW", name: "及时救难", icon: "RenataW.png", description: "" },
      { id: "RenataE", name: "忠诚激励", icon: "RenataE.png", description: "" },
      { id: "RenataR", name: "恶意收购", icon: "RenataR.png", description: "" },
    ],
    effects: {
      RenataP: null,
      RenataQ: null,
      RenataW: null,
      RenataE: null,
      RenataR: null,
    },
  };
}
export { importModule };
