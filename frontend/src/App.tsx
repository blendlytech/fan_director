import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { CatalogProvider } from './state/CatalogContext'
import { CommissionProvider } from './state/CommissionContext'
import { BoutiqueEntrance } from './pages/BoutiqueEntrance'
import { AIDirector } from './pages/AIDirector'
import { ReviewScene } from './pages/ReviewScene'
import { SendConfirmation } from './pages/SendConfirmation'
import { SavedIdeas } from './pages/SavedIdeas'
import { NotFound } from './pages/NotFound'
import { MyRequests } from './pages/MyRequests'
import { MyRequestDetail } from './pages/MyRequestDetail'
import { capabilities } from './config'
import { CreatorDashboard } from './pages/CreatorDashboard'
import { CreatorDetailModal } from './pages/CreatorDetailModal'
import { AskQuestionModal } from './pages/AskQuestionModal'
import { DeclineConfirmationModal } from './pages/DeclineConfirmationModal'

/** Layout route so one commission draft survives every leg of the fan journey,
 *  including "Back to Edit" from Review. The creator side has its own data. */
function FanJourney() {
  return (
    <CatalogProvider>
      <CommissionProvider>
        <Outlet />
      </CommissionProvider>
    </CatalogProvider>
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
        {/* Phase 4, staging only: the requests this fan has sent. The demo has
            nothing to send, so these paths stay "page not found" there. */}
        {capabilities.persistence && (
          <>
            <Route path="/requests" element={<MyRequests />} />
            <Route path="/requests/:id" element={<MyRequestDetail />} />
          </>
        )}
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
