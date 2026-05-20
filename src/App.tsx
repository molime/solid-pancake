import { AppRouter } from './app/router'
import { AppErrorBoundary } from './app/AppErrorBoundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  )
}
