import fs from "fs";
import path from "path";

const directory = "files";
const list = [];

for (let i = 0; i < list.length; i++) {
  const item = list[i];
  const fileName = Object.keys(item)[0];
  const filePath = path.join(directory, `${fileName}.ts`);
  const content = `function importModule() {
  return ${JSON.stringify(item[fileName])}
  }
  export { importModule }
  `;
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error(`写入文件 ${fileName} 时发生错误：`, err);
      return;
    }
    console.log(`文件 ${fileName} 写入成功！`);
  });
}
