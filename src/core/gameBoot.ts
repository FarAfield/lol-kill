import GameLog from "@/core/gameLog";
import GameLoad from "@/core/gameLoad";
import useGameStore from "@/core/gameStore";
import { dynamicImportModule } from "@/core/utils";

class GameBoot {
  // 游戏启动入口
  static async onBoot() {
    const gameStore = useGameStore();
    GameLog.success("System", "游戏启动");
    GameLog.info("游戏资源读取中...");
    // 异步读取资源并存储
    const modules = import.meta.glob("@/source/**/**/*.ts");
    for (const path in modules) {
      const packageName = path.split("/").at(-2);
      const fileName = path.split("/").at(-1)?.replace(".ts", "");
      const { importModule } = await dynamicImportModule(
        packageName!,
        fileName!
      );
      const module = importModule();
      gameStore[`${packageName}Module`] =
        gameStore[`${packageName}Module`].concat(module);
    }
    GameLog.success("System", "资源读取完成");
    // 解析资源
    GameLoad.onLoad();
  }
}

export default GameBoot;
