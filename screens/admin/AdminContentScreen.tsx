import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getNews, createNewsArticle, updateNewsArticle, deleteNewsArticle, getDepartments, uploadFile } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface NewsForm {
    title: string;
    content: string;
    image: string;
    department: string;
    department_code: string;
    is_pinned: boolean;
    is_urgent: boolean;
}

const emptyForm: NewsForm = {
    title: '',
    content: '',
    image: '',
    department: '',
    department_code: '',
    is_pinned: false,
    is_urgent: false,
};

const AdminContentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const { user } = useAuth();
    const { data: rawNews, loading, refetch } = useApi(() => getNews(), []);
    const { data: departments } = useApi(() => getDepartments(), []);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<NewsForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const imageRef = React.useRef<HTMLInputElement>(null);

    // Map news articles from DB
    const contentPosts = (rawNews || []).map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content || '',
        image: post.image || `https://picsum.photos/600/400?random=${post.id}`,
        department: post.department || '',
        department_code: post.department_code || '',
        isPinned: !!post.is_pinned,
        isUrgent: !!post.is_urgent,
        publishedAt: post.published_at ? new Date(post.published_at).toLocaleDateString('th-TH') : '',
        views: post.views || 0,
        likes: post.likes || 0,
    }));

    // Compute stats from data
    const contentStats = {
        totalPosts: contentPosts.length,
        pinnedPosts: contentPosts.filter((p: any) => p.isPinned).length,
        totalViews: contentPosts.reduce((sum: number, p: any) => sum + (p.views || 0), 0),
    };

    // Open create modal
    const handleCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setImageFile(null);
        setShowModal(true);
    };

    // Open edit modal
    const handleEdit = (post: any) => {
        setEditingId(post.id);
        setForm({
            title: post.title,
            content: post.content,
            image: post.image || '',
            department: post.department || '',
            department_code: post.department_code || '',
            is_pinned: post.isPinned,
            is_urgent: post.isUrgent,
        });
        setImageFile(null);
        setShowModal(true);
    };

    // Delete handler
    const handleDelete = async (post: any) => {
        const confirmed = await showConfirm({
            message: `ต้องการลบประกาศ "${post.title}" หรือไม่?`,
            type: 'danger',
            confirmText: 'ลบ',
        });
        if (!confirmed) return;
        try {
            await deleteNewsArticle(post.id);
            toast('ลบประกาศเรียบร้อย', 'success');
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error');
        }
    };

    // Save handler (create / update)
    const handleSave = async () => {
        if (!form.title.trim()) return toast('กรุณากรอกหัวข้อ', 'warning');
        if (!form.content.trim()) return toast('กรุณากรอกเนื้อหา', 'warning');

        setSaving(true);
        try {
            let imageUrl = form.image;
            // Upload image if a new file was selected
            if (imageFile) {
                const result = await uploadFile(imageFile, 'news_image');
                imageUrl = result.url;
            }

            const payload = {
                title: form.title.trim(),
                content: form.content.trim(),
                image: imageUrl,
                department: form.department,
                department_code: form.department_code,
                is_pinned: form.is_pinned ? 1 : 0,
                is_urgent: form.is_urgent ? 1 : 0,
            };

            if (editingId) {
                await updateNewsArticle(editingId, payload);
                toast('อัปเดตประกาศเรียบร้อย', 'success');
            } else {
                await createNewsArticle(payload);
                toast('สร้างประกาศเรียบร้อย', 'success');
            }
            setShowModal(false);
            refetch();
        } catch (err: any) {
            toast(err.message || 'เกิดข้อผิดพลาด', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Department select handler
    const handleDeptSelect = (deptId: string) => {
        const dept = (departments || []).find((d: any) => String(d.id) === deptId);
        if (dept) {
            setForm(f => ({ ...f, department: dept.name, department_code: (dept.name || '').substring(0, 2).toUpperCase() }));
        } else {
            setForm(f => ({ ...f, department: '', department_code: '' }));
        }
    };

    // Image file handler
    const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast('ไฟล์ต้องไม่เกิน 5MB', 'warning');
                return;
            }
            setImageFile(file);
            setForm(f => ({ ...f, image: URL.createObjectURL(file) }));
        }
    };

    const inputCls = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary shadow-sm transition-shadow";
    const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1 mb-1.5";

    return (
        <div className="pt-6 md:pt-8 pb-8 px-4 md:px-8 max-w-[1600px] mx-auto min-h-full">
            <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/profile')} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">จัดการข่าวสาร</h1>
                        <p className="text-xs md:text-base text-gray-500 dark:text-gray-400">ประชาสัมพันธ์และประกาศภายในองค์กร</p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="w-full md:w-auto bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/30 transition-all active:scale-95"
                >
                    <span className="material-icons-round text-xl">post_add</span>
                    สร้างประกาศ
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* News List */}
                <div className="lg:col-span-2 space-y-4">
                    {loading && (
                        <div className="text-center py-16 text-gray-400">
                            <span className="material-icons-round animate-spin text-3xl">autorenew</span>
                        </div>
                    )}
                    {!loading && contentPosts.length === 0 && (
                        <div className="text-center py-16">
                            <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">article</span>
                            <p className="text-gray-400">ยังไม่มีข่าวสาร</p>
                            <button onClick={handleCreate} className="mt-4 text-primary font-semibold hover:underline">
                                สร้างประกาศแรก
                            </button>
                        </div>
                    )}
                    {contentPosts.map((post: any) => (
                        <div key={post.id} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border ${post.isPinned ? 'border-l-4 border-l-primary border-y-gray-100 border-r-gray-100 dark:border-y-gray-700 dark:border-r-gray-700' : 'border-gray-100 dark:border-gray-700'} flex flex-col md:flex-row gap-4`}>
                            <div className={`w-full ${post.isPinned ? 'md:w-48 h-32' : 'md:w-32 h-32 md:h-24'} bg-gray-200 rounded-lg overflow-hidden shrink-0`}>
                                <img src={post.image} className="w-full h-full object-cover" alt="news" />
                            </div>
                            <div className="flex-1 py-1 flex flex-col justify-between">
                                <div>
                                    {post.isPinned && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide">ปักหมุด</span>
                                            {post.isUrgent && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase tracking-wide">ด่วน</span>
                                            )}
                                            <span className="text-xs text-gray-400">{post.publishedAt}</span>
                                        </div>
                                    )}
                                    <h3 className={`${post.isPinned ? 'text-lg' : 'text-base'} font-bold text-gray-900 dark:text-white line-clamp-1`}>{post.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">{post.content}</p>
                                </div>
                                <div className="flex items-center justify-between mt-4 md:mt-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="material-icons-round text-sm">visibility</span>
                                            {post.views}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span className="material-icons-round text-sm">thumb_up</span>
                                            {post.likes}
                                        </div>
                                        {!post.isPinned && <span className="text-xs text-gray-400">{post.publishedAt}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(post)}
                                            className="text-gray-400 hover:text-primary bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg transition-colors"
                                        >
                                            <span className="material-icons-round">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(post)}
                                            className="text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-gray-700/50 p-1.5 rounded-lg transition-colors"
                                        >
                                            <span className="material-icons-round">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Sidebar / Stats */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-4">สถานะการเผยแพร่</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">โพสต์ทั้งหมด</span>
                                <span className="font-bold text-gray-900 dark:text-white">{contentStats.totalPosts}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">ปักหมุด</span>
                                <span className="font-bold text-primary">{contentStats.pinnedPosts}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">ยอดคนอ่านรวม</span>
                                <span className="font-bold text-gray-900 dark:text-white">{contentStats.totalViews.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)}>
                    <div
                        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                        style={{ animation: 'toast-scale-in 0.2s ease-out' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingId ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
                            </h2>
                            <button onClick={() => !saving && setShowModal(false)} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Title */}
                            <div>
                                <label className={labelCls}>หัวข้อ *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="เช่น ประกาศวันหยุดสงกรานต์"
                                    className={inputCls}
                                    maxLength={300}
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className={labelCls}>เนื้อหา *</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                                    placeholder="รายละเอียดข่าวสาร..."
                                    className={`${inputCls} resize-none`}
                                    rows={5}
                                />
                            </div>

                            {/* Department */}
                            <div>
                                <label className={labelCls}>แผนก / ผู้เผยแพร่</label>
                                <select
                                    value={(departments || []).find((d: any) => d.name === form.department)?.id || ''}
                                    onChange={e => handleDeptSelect(e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">— เลือกแผนก —</option>
                                    {(departments || []).map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Image */}
                            <div>
                                <label className={labelCls}>รูปภาพปก</label>
                                <input
                                    ref={imageRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageFile}
                                />
                                {form.image ? (
                                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                                        <img src={form.image} alt="Preview" className="w-full h-40 object-cover" />
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <button
                                                onClick={() => imageRef.current?.click()}
                                                className="bg-white/90 dark:bg-black/70 rounded-full p-1.5 shadow-sm hover:bg-white"
                                            >
                                                <span className="material-icons-round text-sm text-gray-600">edit</span>
                                            </button>
                                            <button
                                                onClick={() => { setForm(f => ({ ...f, image: '' })); setImageFile(null); }}
                                                className="bg-white/90 dark:bg-black/70 rounded-full p-1.5 shadow-sm hover:bg-white"
                                            >
                                                <span className="material-icons-round text-sm text-red-500">close</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => imageRef.current?.click()}
                                        className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-6 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                    >
                                        <span className="material-icons-round text-2xl text-gray-400 group-hover:text-primary">add_photo_alternate</span>
                                        <span className="text-sm text-gray-500 group-hover:text-primary">เลือกรูปภาพ (ไม่เกิน 5MB)</span>
                                    </button>
                                )}
                            </div>

                            {/* Options */}
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.is_pinned}
                                        onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                                        <span className="material-icons-round text-sm text-primary -rotate-45">push_pin</span>
                                        ปักหมุด
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.is_urgent}
                                        onChange={e => setForm(f => ({ ...f, is_urgent: e.target.checked }))}
                                        className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                                        <span className="material-icons-round text-sm text-red-500">priority_high</span>
                                        ด่วน
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <span className="material-icons-round animate-spin text-lg">autorenew</span>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">{editingId ? 'save' : 'post_add'}</span>
                                        {editingId ? 'บันทึก' : 'สร้างประกาศ'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminContentScreen;