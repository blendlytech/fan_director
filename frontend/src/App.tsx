import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { CommissionProvider } from './state/CommissionContext'
import { BoutiqueEntrance } from './pages/BoutiqueEntrance'
import { AIDirector } from './pages/AIDirector'
import { ReviewScene } from './pages/ReviewScene'
import { SendConfirmation } from './pages/SendConfirmation'
import { SavedIdeas } from './pages/SavedIdeas'
import { NotFound } from './pages/NotFound'
import { CreatorDashboard } from './pages/CreatorDashboard'
import { CreatorDetailModal } from './pages/CreatorDetailModal'
import { AskQuestionModal } from './pages/AskQuestionModal'
import { DeclineConfirmationModal } from './pages/DeclineConfirmationModal'

/** Layout route so one commission draft survives every leg of the fan journey,
 *  including "Back to Edit" from Review. The creator side has its own data. */
function FanJourney() {
  return (
    <CommissionProvider>
      <Outlet />
    </CommissionProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<FanJourney />}>
          <Route path="/" element={<BoutiqueEntrance />} />
          <Route path="/ai-director" element={<AIDirector />} />
          <Route path="/review" element={<ReviewScene />} />
          <Route path="/confirmation" element={<SendConfirmation />} />
          <Route path="/saved" element={<SavedIdeas />} />
        </Route>
        <Route path="/creator/requests" element={<CreatorDashboard />}>
          <Route path=":id" element={<CreatorDetailModal />}>
            <Route path="ask" element={<AskQuestionModal />} />
            <Route path="decline" element={<DeclineConfirmationModal />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
