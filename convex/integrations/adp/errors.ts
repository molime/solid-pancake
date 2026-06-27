export class NotConfiguredError extends Error {
  constructor(message = 'ADP is not configured') {
    super(message)
    this.name = 'NotConfiguredError'
  }
}
