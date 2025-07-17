function importModule() {
  return {
    type: "hero",
    id: "Rengar",
    title: "傲之追猎者",
    name: "雷恩加尔",
    avatar: "Rengar.png",
    skins: [
      { name: "default", skin: "Rengar_0.jpg" },
      { name: "铁血猎人 雷恩加尔", skin: "Rengar_1.jpg" },
      { name: "暗黑武士 雷恩加尔", skin: "Rengar_2.jpg" },
      { name: "SSW 雷恩加尔", skin: "Rengar_3.jpg" },
      { name: "霸天战士 雷恩加尔", skin: "Rengar_8.jpg" },
      { name: "雷喵喵尔", skin: "Rengar_15.jpg" },
      { name: "沙之守护 雷恩加尔", skin: "Rengar_23.jpg" },
      { name: "光明哨兵 雷恩加尔", skin: "Rengar_30.jpg" },
      { name: "妖怪艺术家 雷恩加尔", skin: "Rengar_40.jpg" },
    ],
    spells: [
      {
        id: "RengarP",
        name: "无形掠食者",
        icon: "RengarP.png",
        description: "",
      },
      { id: "RengarQ", name: "残忍无情", icon: "RengarQ.png", description: "" },
      { id: "RengarW", name: "战争咆哮", icon: "RengarW.png", description: "" },
      { id: "RengarE", name: "套索打击", icon: "RengarE.png", description: "" },
      { id: "RengarR", name: "狩猎律动", icon: "RengarR.png", description: "" },
    ],
    effects: {
      RengarP: null,
      RengarQ: null,
      RengarW: null,
      RengarE: null,
      RengarR: null,
    },
  };
}
export { importModule };
