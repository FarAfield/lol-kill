function importModule() {
  return {
    type: "hero",
    id: "Brand",
    title: "复仇焰魂",
    name: "布兰德",
    avatar: "Brand.png",
    skins: [
      { name: "default", skin: "Brand_0.jpg" },
      { name: "末日余生 布兰德", skin: "Brand_1.jpg" },
      { name: "V字仇杀者 布兰德", skin: "Brand_2.jpg" },
      { name: "冰晶之核 布兰德", skin: "Brand_3.jpg" },
      { name: "丧尸 布兰德", skin: "Brand_4.jpg" },
      { name: "灵魂烈焰 布兰德", skin: "Brand_5.jpg" },
      { name: "战场BOSS 布兰德", skin: "Brand_6.jpg" },
      { name: "苍穹之光 布兰德", skin: "Brand_7.jpg" },
      { name: "神龙尊者 魔龙布兰德", skin: "Brand_8.jpg" },
      { name: "焰执事 布兰德", skin: "Brand_21.jpg" },
      { name: "至臻 焰执事 布兰德", skin: "Brand_22.jpg" },
      { name: "妖怪艺术家 布兰德", skin: "Brand_33.jpg" },
      { name: "至高天 布兰德", skin: "Brand_42.jpg" },
    ],
    spells: [
      { id: "BrandP", name: "炽热之焰", icon: "BrandP.png", description: "" },
      { id: "BrandQ", name: "火焰烙印", icon: "BrandQ.png", description: "" },
      { id: "BrandW", name: "烈焰之柱", icon: "BrandW.png", description: "" },
      { id: "BrandE", name: "烈火燃烧", icon: "BrandE.png", description: "" },
      { id: "BrandR", name: "烈焰风暴", icon: "BrandR.png", description: "" },
    ],
    effects: {
      BrandP: null,
      BrandQ: null,
      BrandW: null,
      BrandE: null,
      BrandR: null,
    },
  };
}
export { importModule };
