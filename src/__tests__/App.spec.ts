import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import naive from 'naive-ui'
import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import Home from '../views/home/index.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', component: Home },
  ],
})

describe('App', () => {
  it('mounts renders properly', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [naive, router],
      },
    })
    await router.isReady()
    expect(wrapper.text()).toContain('123')
  })
})
