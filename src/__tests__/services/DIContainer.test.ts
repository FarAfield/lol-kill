// ============================================================
// 联盟杀 · DIContainer 单元测试
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { DIContainer } from '@core/services/di-container'

// ── 测试接口 ──

interface ITestService {
  getName(): string
}

class TestService implements ITestService {
  getName(): string {
    return 'test-service'
  }
}

interface IOtherService {
  getValue(): number
}

class OtherService implements IOtherService {
  getValue(): number {
    return 42
  }
}

// ── 测试 ──

describe('DIContainer', () => {
  let container: DIContainer

  beforeEach(() => {
    container = new DIContainer()
  })

  describe('register 和 resolve', () => {
    it('应该能注册和解析一个服务', () => {
      const service = new TestService()
      container.register<ITestService>('ITestService', service)
      const resolved = container.resolve<ITestService>('ITestService')
      expect(resolved).toBe(service)
      expect(resolved.getName()).toBe('test-service')
    })

    it('应该能注册和解析多个服务', () => {
      const testService = new TestService()
      const otherService = new OtherService()

      container.register<ITestService>('ITestService', testService)
      container.register<IOtherService>('IOtherService', otherService)

      expect(container.resolve<ITestService>('ITestService').getName()).toBe('test-service')
      expect(container.resolve<IOtherService>('IOtherService').getValue()).toBe(42)
    })

    it('应该能注册不同类型的服务', () => {
      container.register<string>('config', 'my-config')
      container.register<number>('maxPlayers', 8)

      expect(container.resolve<string>('config')).toBe('my-config')
      expect(container.resolve<number>('maxPlayers')).toBe(8)
    })
  })

  describe('重复注册', () => {
    it('重复注册同一 token 应该报错', () => {
      container.register<ITestService>('ITestService', new TestService())

      expect(() => {
        container.register<ITestService>('ITestService', new TestService())
      }).toThrow(/已被注册/)
    })

    it('错误消息应包含 token 名称', () => {
      container.register<ITestService>('ImportantService', new TestService())

      expect(() => {
        container.register<ITestService>('ImportantService', new TestService())
      }).toThrow('ImportantService')
    })
  })

  describe('解析未注册的 token', () => {
    it('解析未注册的 token 应该报错', () => {
      expect(() => {
        container.resolve<ITestService>('UnregisteredService')
      }).toThrow(/未注册/)
    })

    it('错误消息应包含 token 名称', () => {
      expect(() => {
        container.resolve<ITestService>('UnknownDependency')
      }).toThrow('UnknownDependency')
    })
  })

  describe('has', () => {
    it('已注册的 token 应该返回 true', () => {
      container.register<ITestService>('ITestService', new TestService())
      expect(container.has('ITestService')).toBe(true)
    })

    it('未注册的 token 应该返回 false', () => {
      expect(container.has('ITestService')).toBe(false)
    })

    it('unregister 后 has 应该返回 false', () => {
      container.register<ITestService>('ITestService', new TestService())
      container.unregister('ITestService')
      expect(container.has('ITestService')).toBe(false)
    })
  })

  describe('tryResolve', () => {
    it('已注册的 token 应该返回服务实例', () => {
      const service = new TestService()
      container.register<ITestService>('ITestService', service)
      const resolved = container.tryResolve<ITestService>('ITestService')
      expect(resolved).toBe(service)
    })

    it('未注册的 token 应该返回 undefined', () => {
      const resolved = container.tryResolve<ITestService>('UnknownService')
      expect(resolved).toBeUndefined()
    })
  })

  describe('unregister', () => {
    it('应该能注销已注册的服务', () => {
      const service = new TestService()
      container.register<ITestService>('ITestService', service)
      container.unregister('ITestService')
      expect(container.has('ITestService')).toBe(false)
    })

    it('注销不存在的 token 不应报错', () => {
      expect(() => {
        container.unregister('NonExistent')
      }).not.toThrow()
    })
  })

  describe('clear', () => {
    it('应该清空所有注册的服务', () => {
      container.register<ITestService>('ServiceA', new TestService())
      container.register<ITestService>('ServiceB', new TestService())
      expect(container.size).toBe(2)

      container.clear()
      expect(container.size).toBe(0)
      expect(container.has('ServiceA')).toBe(false)
      expect(container.has('ServiceB')).toBe(false)
    })
  })

  describe('size', () => {
    it('初始大小应为 0', () => {
      expect(container.size).toBe(0)
    })

    it('注册服务后大小应增加', () => {
      container.register<ITestService>('ServiceA', new TestService())
      expect(container.size).toBe(1)

      container.register<ITestService>('ServiceB', new TestService())
      expect(container.size).toBe(2)
    })
  })
})
