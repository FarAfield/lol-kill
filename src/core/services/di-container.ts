// ============================================================
// 联盟杀 · DIContainer — 轻量级依赖注入容器
//
// 提供基于 token 字符串的服务注册与解析。
// 设计目标：
// - 零外部依赖
// - 类型安全的 resolve<T>(token)
// - 不允许重复注册
// - 解析未注册 token 时抛出明确异常
//
// 用法：
//   const container = new DIContainer()
//   container.register('ILoggerService', new ConsoleLogger())
//   const logger = container.resolve<ILoggerService>('ILoggerService')
// ============================================================

/**
 * 轻量级依赖注入容器
 *
 * 引擎和 UI 之间的服务通过此容器解耦。
 * 引擎在初始化时注册默认服务，
 * UI 或测试可以通过替换容器中的服务来自定义行为。
 */
export class DIContainer {
  private registry: Map<string, unknown> = new Map()

  /**
   * 注册一个服务实例。
   *
   * @param token    服务标识符（字符串）
   * @param instance 服务实例
   * @throws 如果 token 已被注册
   */
  register<T>(token: string, instance: T): void {
    if (this.registry.has(token)) {
      throw new Error(`[DIContainer] Token "${token}" 已被注册，不允许重复注册。`)
    }
    this.registry.set(token, instance)
  }

  /**
   * 解析一个服务实例。
   *
   * @param token 服务标识符
   * @returns 对应类型的服务实例
   * @throws 如果 token 未注册
   */
  resolve<T>(token: string): T {
    if (!this.registry.has(token)) {
      throw new Error(`[DIContainer] Token "${token}" 未注册。`)
    }
    return this.registry.get(token) as T
  }

  /**
   * 检查指定 token 是否已注册。
   */
  has(token: string): boolean {
    return this.registry.has(token)
  }

  /**
   * 尝试解析服务，如果未注册则返回 undefined。
   */
  tryResolve<T>(token: string): T | undefined {
    return this.registry.get(token) as T | undefined
  }

  /**
   * 注销一个服务。
   */
  unregister(token: string): void {
    this.registry.delete(token)
  }

  /**
   * 清空所有注册的服务。
   */
  clear(): void {
    this.registry.clear()
  }

  /**
   * 当前注册的服务数量。
   */
  get size(): number {
    return this.registry.size
  }
}

/**
 * 全局 DI 容器单例
 *
 * 引擎和 UI 通过此单例共享服务。
 * 初始化时注册引擎端服务（RandomService, LoggerService 等），
 * UI 端通过 resolve 获取。
 */
export const globalContainer = new DIContainer()
