function importModule() {
  return {
    type: "hero",
    id: "Renekton",
    title: "荒漠屠夫",
    name: "雷克顿",
    avatar: "Renekton.png",
    skins: [
      { name: "default", skin: "Renekton_0.jpg" },
      { name: "星河战队 雷克顿", skin: "Renekton_1.jpg" },
      { name: "荒野之咬 雷克顿", skin: "Renekton_2.jpg" },
      { name: "血石战神 雷克顿", skin: "Renekton_3.jpg" },
      { name: "符文战神 雷克顿", skin: "Renekton_4.jpg" },
      { name: "枯萎之壤 雷克顿", skin: "Renekton_5.jpg" },
      { name: "泳池派对 雷克顿", skin: "Renekton_6.jpg" },
      { name: "猛龙 雷克顿", skin: "Renekton_7.jpg" },
      { name: "SKT T1 雷克顿", skin: "Renekton_8.jpg" },
      { name: "鳄霸 雷克顿", skin: "Renekton_9.jpg" },
      { name: "海克斯科技 雷克顿", skin: "Renekton_17.jpg" },
      { name: "黯晶巨鳄 雷克顿", skin: "Renekton_18.jpg" },
      { name: "源计划：泯灭 雷克顿", skin: "Renekton_26.jpg" },
      { name: "黎明使者 雷克顿", skin: "Renekton_33.jpg" },
      { name: "2023 全球总决赛 雷克顿", skin: "Renekton_42.jpg" },
    ],
    spells: [
      {
        id: "RenektonP",
        name: "怒之领域",
        icon: "RenektonP.png",
        description: "",
      },
      {
        id: "RenektonQ",
        name: "巨鳄狂袭",
        icon: "RenektonQ.png",
        description: "",
      },
      {
        id: "RenektonW",
        name: "冷酷捕猎",
        icon: "RenektonW.png",
        description: "",
      },
      {
        id: "RenektonE",
        name: "横冲直撞",
        icon: "RenektonE.png",
        description: "",
      },
      {
        id: "RenektonR",
        name: "终极统治",
        icon: "RenektonR.png",
        description: "",
      },
    ],
    effects: {
      RenektonP: null,
      RenektonQ: null,
      RenektonW: null,
      RenektonE: null,
      RenektonR: null,
    },
  };
}
export { importModule };
