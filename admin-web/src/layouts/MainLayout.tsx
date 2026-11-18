import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ChatBox from '../components/ChatBox';

// Trang không hiện ChatBox: đăng nhập và đăng ký.
const NO_CHAT_PATHS = ['/login', '/register'];

export default function MainLayout() {
  const { pathname } = useLocation();

  return (
    <div className="stitch-app min-h-screen flex flex-col">
      <Navbar />
      <main className="stitch-main">
        <Outlet />
      </main>
      <Footer />
      {!NO_CHAT_PATHS.includes(pathname) && <ChatBox />}
    </div>
  );
}
