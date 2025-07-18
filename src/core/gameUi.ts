import { h, createApp, VNode } from "vue";
import ArcoVue from "@arco-design/web-vue";
import ChooseHero from "@/components/chooseHero/index.vue";
import { IGameHero } from "@/core/game.types";

function withPromise() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return [promise, resolve, reject];
}
function createModal(vNode: VNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const modalApp = createApp({
    setup() {
      return () => vNode;
    },
  });
  modalApp.use(ArcoVue);
  modalApp.mount(container);
  return () => {
    modalApp.unmount();
    document.body.removeChild(container);
  };
}
class GameUi {
  static async chooseHero(): Promise<IGameHero> {
    const [promise, resolve] = withPromise();
    const destroy = createModal(
      h(ChooseHero, {
        showModal: true,
        quantity: 3,
        onConfirm: onConfirm,
        onCancel: onCancel,
      })
    );
    function onConfirm(result: IGameHero & { skin: string }) {
      resolve(result);
      destroy();
    }
    function onCancel() {
      resolve(null);
      destroy();
    }
    return promise;
  }
}
export default GameUi;
