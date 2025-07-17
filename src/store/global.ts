import { defineStore } from "pinia";

interface GlobalState {
  [key: string]: any;
}

export default defineStore("global", {
  state: (): GlobalState => ({}),
  getters: {},
  actions: {},
});
