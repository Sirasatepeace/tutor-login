import type { Metadata } from 'next';
import './globals.css';
import './exams.css';
import './assistant.css';
import './names.css';
export const metadata:Metadata={title:'Yingyai Classroom — พื้นที่ของการเรียนรู้',description:'คอร์สเรียน วิดีโอ และเอกสารประกอบ ในห้องเรียนส่วนตัวของคุณ'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}
