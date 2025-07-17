function importModule() {
  return {
    type: "hero",
    id: "Nautilus",
    title: "深海泰坦",
    name: "诺提勒斯",
    avatar: "Nautilus.png",
    skins: [
      { name: "default", skin: "Nautilus_0.jpg" },
      { name: "失落大陆 诺提勒斯", skin: "Nautilus_1.jpg" },
      { name: "地底迷城 诺提勒斯", skin: "Nautilus_2.jpg" },
      { name: "宇航员 诺提勒斯", skin: "Nautilus_3.jpg" },
      { name: "光明骑士 诺提勒斯", skin: "Nautilus_4.jpg" },
      { name: "创世之神 诺提勒斯", skin: "Nautilus_5.jpg" },
      { name: "征服者 诺提勒斯", skin: "Nautilus_6.jpg" },
      { name: "山海绘卷 诺提勒斯", skin: "Nautilus_9.jpg" },
      { name: "魔域梦魇 诺提勒斯", skin: "Nautilus_18.jpg" },
      { name: "星界圣骑 诺提勒斯", skin: "Nautilus_27.jpg" },
      { name: "水晶泰坦 诺提勒斯", skin: "Nautilus_36.jpg" },
    ],
    spells: [
      {
        id: "NautilusP",
        name: "排山倒海",
        icon: "NautilusP.png",
        description: "",
      },
      {
        id: "NautilusQ",
        name: "疏通航道",
        icon: "NautilusQ.png",
        description: "",
      },
      {
        id: "NautilusW",
        name: "泰坦之怒",
        icon: "NautilusW.png",
        description: "",
      },
      {
        id: "NautilusE",
        name: "暗流涌动",
        icon: "NautilusE.png",
        description: "",
      },
      {
        id: "NautilusR",
        name: "深海冲击",
        icon: "NautilusR.png",
        description: "",
      },
    ],
    effects: {
      NautilusP: null,
      NautilusQ: null,
      NautilusW: null,
      NautilusE: null,
      NautilusR: null,
    },
  };
}
export { importModule };
