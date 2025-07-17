import { render, h } from "vue";
import { IGameHero } from "@/core/game.types";
import ChooseHero from "@/components/chooseHero/index.vue";

// function withPromise() {
//   let resolve, reject;
//   return [
//     new Promise((res, rej) => {
//       resolve = res;
//       reject = rej;
//     }),
//     resolve,
//     reject,
//   ];
// }

class GameUi {
  // static async chooseHero() {
  //   const [promise, resolve, reject] = withPromise();
  //   console.log(
  //     123456,
  //     h("choose-hero", {
  //       showModal: true,
  //       quantity: 3,
  //       onConfirm: onConfirm,
  //       onCancel: onCancel,
  //     })
  //   );
  //   render(
  //     h("choose-hero", {
  //       showModal: true,
  //       quantity: 3,
  //       onConfirm: onConfirm,
  //       onCancel: onCancel,
  //     }),
  //     document.body
  //   );
  //   function onConfirm(result: IGameHero & { skin: string }) {
  //     resolve(result);
  //     onCancel();
  //   }
  //   function onCancel() {
  //     render(null, document.body);
  //   }
  //   // return promise;
  // }
}
export default GameUi;
