import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getNews, createNewsArticle, updateNewsArticle, deleteNewsArticle, getDepartments, getCompanies, uploadFile, getNewsCategories, createNewsCategory, deleteNewsCategory } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';

interface NewsForm {
    title: string;
    content: string;
    image: string;
    department: string;
    department_code: string;
    category: string;
    is_pinned: boolean;
    is_urgent: boolean;
    target_companies: number[] | 'all';
    target_audience: 'all' | 'specific';
    target_departments: number[];
}

const emptyForm: NewsForm = {
    title: '',
    content: '',
    image: '',
    department: '',
    department_code: '',
    category: 'ประกาศทั่วไป',
    is_pinned: false,
    is_urgent: false,
    target_companies: 'all',
    target_audience: 'all',
    target_departments: [],
};

const AdminContentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { toast, confirm: showConfirm } = useToast();
    const { user } = useAuth();
    const { data: rawNews, loading, refetch } = useApi(() => getNews(), []);
    const { data: departments } = useApi(() => getDepartments(), []);
    const { data: companies } = useApi(() => getCompanies(), []);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<NewsForm>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const imageRef = React.useRef<HTMLInputElement>(null);

    // Category Modal state
    const { data: categories, refetch: refetchCategories } = useApi(() => getNewsCategories(), []);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setAddingCategory(true);
        try {
            await createNewsCategory(newCategoryName.trim());
            setNewCategoryName('');
            refetchCategories();
            toast('เพิ่มหมวดหมู่สำเร็จ', 'success');
        } catch {
            toast('ไม่สามารถเพิ่มหมวดหมู่ได้', 'error');
        } finally {
            setAddingCategory(false);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        const confirmed = await showConfirm({
            title: 'ลบหมวดหมู่?',
            message: 'ยืนยันการลบหมวดหมู่นี้หรือไม่?',
            type: 'danger',
            confirmText: 'ลบ',
        });
        
        if (!confirmed) return;

        try {
            await deleteNewsCategory(id);
            refetchCategories();
            toast('ลบหมวดหมู่สำเร็จ', 'success');
        } catch {
            toast('ไม่สามารถลบหมวดหมู่ได้', 'error');
        }
    };

    const getCoverImage = (img: any, id: any) => {
        if (!img) return `https://picsum.photos/600/400?random=${id}`;
        try {
            const parsed = JSON.parse(img);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        } catch { }
        return img;
    };
    
    const getAllImages = (img: any) => {
        if (!img) return [];
        try {
            const parsed = JSON.parse(img);
            if (Array.isArray(parsed)) return parsed;
        } catch { 
            if (typeof img === 'string' && img.startsWith('[')) {
                return [];
            }
        }
        return [img];
    };

    // Map news articles from DB
    const contentPosts = (rawNews || []).map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content || '',
        image: post.image || '',
        coverImage: getCoverImage(post.image, post.id),
        department: post.department || '',
        department_code: post.department_code || '',
        category: post.category || 'ประกาศทั่วไป',
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
        setImageFiles([]);
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
            category: post.category || 'ประกาศทั่วไป',
            is_pinned: post.isPinned,
            is_urgent: post.isUrgent,
            target_companies: post.target_companies ? (post.target_companies === 'all' ? 'all' : JSON.parse(post.target_companies)) : 'all',
            target_audience: post.target_departments ? (post.target_departments === 'all' ? 'all' : 'specific') : 'all',
            target_departments: post.target_departments && post.target_departments !== 'all' ? JSON.parse(post.target_departments) : [],
        });
        setImageFiles([]);
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
            // Upload image if new files were selected
            if (imageFiles.length > 0) {
                const results = await Promise.all(imageFiles.map(f => uploadFile(f, 'news_image')));
                
                // Merge with existing images if edit, or just replace entirely?
                // For simplicity, if adding new images via file picker, we APPEND to the existing array
                const existingUrls = getAllImages(form.image);
                const newUrls = results.map(r => r.url);
                imageUrl = JSON.stringify([...existingUrls, ...newUrls]);
            } else if (imageUrl && !imageUrl.startsWith('[')) {
                // Formatting migration if it's a single string and we didn't add new images
                imageUrl = JSON.stringify([imageUrl]);
            }

            const payload = {
                title: form.title.trim(),
                content: form.content.trim(),
                image: imageUrl,
                department: form.department,
                department_code: form.department_code,
                category: form.category,
                is_pinned: form.is_pinned ? 1 : 0,
                is_urgent: form.is_urgent ? 1 : 0,
                target_companies: form.target_companies,
                target_departments: form.target_audience === 'all' ? 'all' : form.target_departments,
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
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;
        
        let validFiles: File[] = [];
        for (const file of files) {
            if (file.size > 20 * 1024 * 1024) { 
                toast(`ไฟล์ ${file.name} เกิน 20MB และถูกข้าม`, 'warning'); 
            } else {
                validFiles.push(file);
            }
        }
        
        if (validFiles.length) {
            setImageFiles(prev => [...prev, ...validFiles]);
            // We append temporary blob URLs to form.image (only for preview context)
            // But form.image is string. We should just let imageFiles be previewed below.
        }
        
        e.target.value = '';
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
                                <img src={post.coverImage} className="w-full h-full object-cover" alt="news" />
                            </div>
                            <div className="flex-1 py-1 flex flex-col justify-between">
                                <div>
                                    {post.isPinned && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase tracking-wide">ปักหมุด</span>
                                            {post.isUrgent && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase tracking-wide">ด่วน</span>
                                            )}
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">{post.category}</span>
                                            <span className="text-xs text-gray-400">{post.publishedAt}</span>
                                        </div>
                                    )}
                                    {!post.isPinned && (
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 uppercase tracking-wide">{post.category}</span>
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

                            {/* Target Company */}
                            {user?.isSuperAdmin && (
                                <div>
                                    <label className={labelCls}>กลุ่มเป้าหมาย (บริษัท)</label>
                                    <div className="flex flex-col gap-2 mt-1">
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <input 
                                                type="radio" 
                                                checked={form.target_companies === 'all'} 
                                                onChange={() => setForm(f => ({ ...f, target_companies: 'all' }))}
                                                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                                            />
                                            ทุกบริษัท
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <input 
                                                type="radio" 
                                                checked={form.target_companies !== 'all'} 
                                                onChange={() => setForm(f => ({ ...f, target_companies: [] }))}
                                                className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                                            />
                                            ระบุบริษัท
                                        </label>
                                    </div>
                                    {form.target_companies !== 'all' && (
                                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2 max-h-40 overflow-y-auto">
                                            {(companies || []).map((c: any) => (
                                                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                    <input 
                                                        type="checkbox"
                                                        checked={(form.target_companies as number[]).includes(c.id)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setForm(f => {
                                                                const tc = Array.isArray(f.target_companies) ? [...f.target_companies] : [];
                                                                if (checked) {
                                                                    if (!tc.includes(c.id)) tc.push(c.id);
                                                                } else {
                                                                    const idx = tc.indexOf(c.id);
                                                                    if (idx > -1) tc.splice(idx, 1);
                                                                }
                                                                return { ...f, target_companies: tc };
                                                            });
                                                        }}
                                                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                    />
                                                    {c.name}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Target Departments */}
                            <div>
                                <label className={labelCls}>กลุ่มเป้าหมาย (พนักงานที่เห็นโพสต์นี้)</label>
                                <div className="flex flex-col gap-2 mt-1">
                                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <input 
                                            type="radio" 
                                            checked={form.target_audience === 'all'} 
                                            onChange={() => setForm(f => ({ ...f, target_audience: 'all', target_departments: [] }))}
                                            className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                                        />
                                        พนักงานทุกคน
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <input 
                                            type="radio" 
                                            checked={form.target_audience === 'specific'} 
                                            onChange={() => setForm(f => ({ ...f, target_audience: 'specific' }))}
                                            className="w-4 h-4 text-primary focus:ring-primary border-gray-300"
                                        />
                                        ระบุแผนก
                                    </label>
                                </div>
                                {form.target_audience === 'specific' && (
                                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col gap-2 max-h-40 overflow-y-auto">
                                        {(departments || []).map((d: any) => (
                                            <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <input 
                                                    type="checkbox"
                                                    checked={form.target_departments.includes(d.id)}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setForm(f => {
                                                            const td = [...f.target_departments];
                                                            if (checked) {
                                                                if (!td.includes(d.id)) td.push(d.id);
                                                            } else {
                                                                const idx = td.indexOf(d.id);
                                                                if (idx > -1) td.splice(idx, 1);
                                                            }
                                                            return { ...f, target_departments: td };
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                />
                                                {d.name}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Category */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className={labelCls.replace('mb-1', '')}>หมวดหมู่ *</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCategoryModal(true)}
                                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                                    >
                                        <span className="material-icons-round text-sm">settings</span>
                                        จัดการหมวดหมู่
                                    </button>
                                </div>
                                <select
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                    className={inputCls}
                                >
                                    {(categories || []).map((c: any) => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Image */}
                            <div>
                                <label className={labelCls}>ไฟล์แนบ (รูปภาพ หรือ PDF)</label>
                                <input
                                    ref={imageRef}
                                    type="file"
                                    multiple
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    onChange={handleImageFile}
                                />
                                
                                {/* Existing Images Preview */}
                                {getAllImages(form.image).length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {getAllImages(form.image).map((imgUrl, i) => (
                                            <div key={i} className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 h-24 bg-gray-50 dark:bg-gray-800">
                                                {imgUrl.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center justify-center w-full h-full p-2">
                                                        <span className="material-icons-round text-3xl text-red-500">picture_as_pdf</span>
                                                        <span className="text-[10px] text-gray-500 text-center w-full truncate mt-1">เอกสาร PDF</span>
                                                    </div>
                                                ) : (
                                                    <img src={imgUrl} alt="Preview" className="w-full h-full object-cover" />
                                                )}
                                                <button
                                                    onClick={() => {
                                                        const urls = getAllImages(form.image);
                                                        urls.splice(i, 1);
                                                        setForm(f => ({ ...f, image: JSON.stringify(urls) }));
                                                    }}
                                                    className="absolute top-1 right-1 bg-white/90 dark:bg-black/70 rounded-full p-1 shadow-sm hover:bg-white text-red-500 z-10"
                                                >
                                                    <span className="material-icons-round text-sm">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* New Image Files Preview */}
                                {imageFiles.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        {imageFiles.map((file, i) => (
                                            <div key={`new-${i}`} className="relative rounded-xl overflow-hidden border-2 border-primary border-dashed h-24 bg-gray-50 dark:bg-gray-800">
                                                {file.type === 'application/pdf' ? (
                                                    <div className="flex flex-col items-center justify-center w-full h-full p-2">
                                                        <span className="material-icons-round text-3xl text-red-500">picture_as_pdf</span>
                                                        <span className="text-[10px] text-gray-500 text-center w-full truncate mt-1">{file.name}</span>
                                                    </div>
                                                ) : (
                                                    <img src={URL.createObjectURL(file)} alt="New Preview" className="w-full h-full object-cover opacity-80" />
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                                                    }}
                                                    className="absolute top-1 right-1 bg-white/90 dark:bg-black/70 rounded-full p-1 shadow-sm hover:bg-white text-red-500 z-10"
                                                >
                                                    <span className="material-icons-round text-sm">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                <button
                                    onClick={() => imageRef.current?.click()}
                                    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-4 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                >
                                    <span className="material-icons-round text-2xl text-gray-400 group-hover:text-primary">upload_file</span>
                                    <span className="text-sm text-gray-500 group-hover:text-primary">เพิ่มรูปภาพหรือ PDF (ไม่เกิน 20MB)</span>
                                </button>
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

            {/* Manage Categories Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">จัดการหมวดหมู่</h3>
                            <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex gap-2 mb-6">
                                <input 
                                    type="text" 
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="ชื่อหมวดหมู่ใหม่..."
                                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm dark:text-white"
                                />
                                <button 
                                    onClick={handleAddCategory}
                                    disabled={!newCategoryName.trim() || addingCategory}
                                    className="px-4 py-2 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
                                >
                                    เพิ่ม
                                </button>
                            </div>
                            <div className="space-y-2">
                                {(categories || []).map((c: any) => (
                                    <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                        <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{c.name}</span>
                                        <button 
                                            onClick={() => handleDeleteCategory(c.id)}
                                            className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center"
                                        >
                                            <span className="material-icons-round text-sm">delete</span>
                                        </button>
                                    </div>
                                ))}
                                {(!categories || categories.length === 0) && (
                                    <p className="text-center text-gray-400 text-sm py-4">ไม่มีหมวดหมู่</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminContentScreen;