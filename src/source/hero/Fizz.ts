function importModule() {
  return {
    type: "hero",
    id: "Fizz",
    title: "潮汐海灵",
    name: "菲兹",
    avatar: "Fizz.png",
    skins: [
      { name: "default", skin: "Fizz_0.jpg" },
      { name: "失落大陆 菲兹", skin: "Fizz_1.jpg" },
      { name: "苔原猎手 菲兹", skin: "Fizz_2.jpg" },
      { name: "海牛猎手 菲兹", skin: "Fizz_3.jpg" },
      { name: "虚空海灵 菲兹", skin: "Fizz_4.jpg" },
      { name: "兔宝宝 菲兹", skin: "Fizz_8.jpg" },
      { name: "银河魔装机神 菲兹", skin: "Fizz_9.jpg" },
      { name: "欧米伽小队 鬼影蛙人", skin: "Fizz_10.jpg" },
      { name: "绒毛菲兹", skin: "Fizz_14.jpg" },
      { name: "至臻 绒毛菲兹", skin: "Fizz_15.jpg" },
      { name: "小恶魔 菲兹", skin: "Fizz_16.jpg" },
      { name: "至臻 绒毛菲兹 (2022)", skin: "Fizz_25.jpg" },
      { name: "宇航员 菲兹", skin: "Fizz_26.jpg" },
      { name: "青蛙雨衣 菲兹", skin: "Fizz_35.jpg" },
    ],
    spells: [
      { id: "FizzP", name: "伶俐斗士", icon: "FizzP.png", description: "" },
      { id: "FizzQ", name: "淘气打击", icon: "FizzQ.png", description: "" },
      { id: "FizzW", name: "海石三叉戟", icon: "FizzW.png", description: "" },
      { id: "FizzE", name: "古灵/精怪", icon: "FizzE.png", description: "" },
      { id: "FizzR", name: "巨鲨强袭", icon: "FizzR.png", description: "" },
    ],
    effects: {
      FizzP: null,
      FizzQ: null,
      FizzW: null,
      FizzE: null,
      FizzR: null,
    },
  };
}
export { importModule };
