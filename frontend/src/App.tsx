import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { BoutiqueEntrance } from './pages/BoutiqueEntrance'
import { AIDirector } from './pages/AIDirector'
import { ReviewScene } from './pages/ReviewScene'
import { SendConfirmation } from './pages/SendConfirmation'
import { SavedIdeas } from './pages/SavedIdeas'
import { CreatorDashboard } from './pages/CreatorDashboard'
import { CreatorDetailModal } from './pages/CreatorDetailModal'
import { AskQuestionModal } from './pages/AskQuestionModal'
import { DeclineConfirmationModal } from './pages/DeclineConfirmationModal'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BoutiqueEntrance />} />
        <Route path="/ai-director" element={<AIDirector />} />
        <Route path="/review" element={<ReviewScene />} />
        <Route path="/confirmation" element={<SendConfirmation />} />
        <Route path="/saved" element={<SavedIdeas />} />
        <Route path="/creator/requests" element={<CreatorDashboard />}>
          <Route path=":id" element={<CreatorDetailModal />}>
            <Route path="ask" element={<AskQuestionModal />} />
            <Route path="decline" element={<DeclineConfirmationModal />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
