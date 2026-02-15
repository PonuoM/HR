import { NewsItem } from '../types';

/** Pinned news item for NewsScreen */
export const PINNED_NEWS: NewsItem = {
    id: 'pinned-1',
    title: 'กำหนดการงานเลี้ยงปีใหม่ประจำปี 2024 และกิจกรรมจับฉลากของขวัญ',
    content: 'ขอเชิญเพื่อนพนักงานทุกท่านเข้าร่วมงานเลี้ยงสังสรรค์ส่งท้ายปีเก่าต้อนรับปีใหม่ ในธีม Neon Galaxy...',
    image: 'https://picsum.photos/200/200?random=1',
    department: 'ฝ่ายทรัพยากรบุคคล',
    timestamp: 'วันนี้',
    likes: 128,
    comments: 42,
    isPinned: true,
    isUrgent: true,
};

/** Latest news articles for NewsScreen */
export const NEWS_ARTICLES: NewsItem[] = [
    {
        id: 'news-1',
        title: 'ประกาศวันหยุดสงกรานต์',
        content: 'เรียนพนักงานทุกท่าน บริษัทขอประกาศวันหยุดเนื่องในเทศกาลสงกรานต์ ตั้งแต่วันที่ 13-16 เมษายน นี้ เพื่อให้พนักงานได้กลับภูมิลำเนา...',
        image: 'https://picsum.photos/600/400?random=2',
        department: 'ฝ่ายทรัพยากรบุคคล',
        departmentCode: 'HR',
        timestamp: '2 ชั่วโมงที่แล้ว',
        likes: 56,
        comments: 8,
    },
    {
        id: 'news-2',
        title: 'แจ้งปิดปรับปรุงระบบเซิร์ฟเวอร์',
        content: 'จะมีการปิดปรับปรุงระบบในวันเสาร์ที่ 20 นี้ เวลา 22:00 - 02:00 น. เพื่อทำการอัปเกรดความปลอดภัย ขออภัยในความไม่สะดวก',
        image: '',
        department: 'ฝ่ายไอที',
        departmentCode: 'IT',
        timestamp: 'เมื่อวานนี้',
        likes: 24,
        comments: 3,
    },
];
