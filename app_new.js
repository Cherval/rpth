// Tabletop Online - Clean Vue.js Implementation
console.log('🚀 Starting Tabletop Online...');

// Configuration
const SUPABASE_URL = 'https://nvjqgqvekhhagiapxxfy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8Rdwr0yNItVCLxvfdD3X7A_nkDQYD7a';

// Initialize Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Toast notification system (Vue reactive)
const toastState = Vue.reactive({
    show: false,
    message: '',
    type: 'info',
    timeout: null
});
const toast = {
    show: (message, type = 'info', duration = 3000) => {
        toastState.message = message;
        toastState.type = type;
        toastState.show = true;
        if (toastState.timeout) clearTimeout(toastState.timeout);
        toastState.timeout = setTimeout(() => {
            toastState.show = false;
        }, duration);
    }
};

// Vue App
const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
    setup() {
        console.log('⚙️ Vue setup starting...');

        // ===== STATE MANAGEMENT =====
        const loading = ref(true);
        const loadingMessage = ref('กำลังโหลด Tabletop World...');
        const error = ref(null);

        // Auth state
        const user = ref(null);
        const profile = ref(null);

        // App state
        const maps = ref([]);
        const currentMap = ref(null);
        const cells = ref([]);
        const territories = ref([]);
        const activeModal = ref(null);
        const activeCell = ref(null);

        // Admin state
        const adminMode = ref(null);
        const selectedCells = ref([]);
        const allProfiles = ref([]);

        // Forms
        const loginForm = reactive({ email: '', password: '' });
        const profileForm = reactive({ avatar_url: '' });
        const decoForm = reactive({
            userId: null,
            decoId: 'none',
            glowColor: '#fbbf24'
        });
        const territoryForm = reactive({ ownerId: null });
        const adminMoveForm = reactive({ targetUserId: null });
        const mapForm = reactive({
            id: null,
            name: '',
            description: '',
            image_url: ''
        });

        // UI state
        const showAddMapForm = ref(false);
        const mapToDelete = ref(null);
        const selectedOwner = ref(null);

        // ===== COMPUTED PROPERTIES =====
        const isAdmin = computed(() => {
            return profile.value?.role === 'admin' || profile.value?.role === 'mod';
        });

        const canJoinCell = computed(() => {
            if (!activeCell.value) return false;
            if (activeCell.value.occupant) return false;
            if (activeCell.value.is_locked && activeCell.value.owner_id !== profile.value?.id && !isAdmin.value) return false;
            return true;
        });

        const isMyCharacterHere = computed(() => {
            return activeCell.value?.occupant?.id === profile.value?.id;
        });

        const isMyTerritory = computed(() => {
            return activeCell.value?.owner_id === profile.value?.id;
        });

        // ===== UTILITY FUNCTIONS =====
        const handleImageError = (event) => {
            event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjMWMxYzFlIi8+Cjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPHN2Zz4=';
        };

        const showOwnerDetail = (territory) => {
            const owner = allProfiles.value.find(p => p.id === territory.owner_id);
            if (owner) {
                selectedOwner.value = owner;
                showModal('ownerDetail');
            }
        };

        const showModal = (modalName) => {
            activeModal.value = modalName;
        };

        const closeModal = () => {
            activeModal.value = null;
        };

        // ===== AUTHENTICATION =====
        const login = async () => {
            try {
                loadingMessage.value = 'กำลังเข้าสู่ระบบ...';
                loading.value = true;

                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: loginForm.email,
                    password: loginForm.password
                });

                if (error) throw error;

                toast.show('เข้าสู่ระบบสำเร็จ!', 'success');
                closeModal();
                await loadAppData();

            } catch (err) {
                console.error('Login error:', err);
                toast.show(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
            } finally {
                loading.value = false;
            }
        };

        const logout = async () => {
            try {
                await supabaseClient.auth.signOut();
                user.value = null;
                profile.value = null;
                currentMap.value = null;
                cells.value = [];
                territories.value = [];
                toast.show('ออกจากระบบแล้ว');
            } catch (err) {
                console.error('Logout error:', err);
                toast.show('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
            }
        };

        // ===== DATA LOADING =====
        const loadAppData = async () => {
            try {
                console.log('📊 Loading app data...');

                // Get current session
                const { data: { session } } = await supabaseClient.auth.getSession();
                user.value = session?.user || null;

                if (user.value) {
                    // Load user profile
                    const { data: profileData, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('*')
                        .eq('id', user.value.id)
                        .single();

                    if (profileError) throw profileError;
                    profile.value = profileData;

                    // Load all profiles for admin
                    if (isAdmin.value) {
                        const { data: profilesData } = await supabaseClient
                            .from('profiles')
                            .select('id, character_name, real_name, avatar_url');
                        allProfiles.value = profilesData || [];
                    }
                }

                // Load maps
                const { data: mapsData, error: mapsError } = await supabaseClient
                    .from('maps')
                    .select('*')
                    .eq('is_deleted', false)
                    .order('created_at', { ascending: false });

                if (mapsError) throw mapsError;
                maps.value = mapsData || [];

                console.log('✅ App data loaded successfully');

            } catch (err) {
                console.error('❌ Error loading app data:', err);
                error.value = err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
                toast.show(error.value, 'error');
            }
        };

        const loadMapData = async () => {
            if (!currentMap.value) return;

            try {
                console.log('🗺️ Loading map data...');

                // Initialize grid
                const grid = [];
                for (let y = 0; y < 12; y++) {
                    for (let x = 0; x < 12; x++) {
                        grid.push({
                            x, y,
                            owner_id: null,
                            owner_name: null,
                            is_locked: false,
                            territory_id: null,
                            occupant: null
                        });
                    }
                }
                cells.value = grid;

                // Load territories
                const { data: territories, error: terrError } = await supabaseClient
                    .from('territory_cells')
                    .select(`
                        x, y, territory_id,
                        territories!inner(
                            owner_id, is_locked,
                            profiles!territories_owner_id_fkey(character_name)
                        )
                    `)
                    .eq('territories.map_id', currentMap.value.id);

                if (terrError) {
                    console.warn('Territory loading warning:', terrError);
                }

                // Load players
                const { data: players, error: playersError } = await supabaseClient
                    .from('profiles')
                    .select('*, decorations(*)')
                    .eq('current_map_id', currentMap.value.id);

                if (playersError) {
                    console.warn('Players loading warning:', playersError);
                }

                // Merge data into cells
                cells.value.forEach(cell => {
                    // Add territory data
                    const territory = territories?.find(t => t.x === cell.x && t.y === cell.y);
                    if (territory) {
                        cell.owner_id = territory.territories.owner_id;
                        cell.owner_name = territory.territories.profiles?.character_name || 'ไม่ระบุชื่อ';
                        cell.is_locked = territory.territories.is_locked;
                        cell.territory_id = territory.territory_id;
                    }

                    // Add player data
                    const player = players?.find(p => p.current_x === cell.x && p.current_y === cell.y);
                    if (player) {
                        cell.occupant = {
                            ...player,
                            decoration: player.decorations?.[0] || null
                        };
                    }
                });

                // Group cells into territories
                const territoryMap = new Map();
                cells.value.forEach(cell => {
                    if (cell.territory_id) {
                        if (!territoryMap.has(cell.territory_id)) {
                            territoryMap.set(cell.territory_id, {
                                id: cell.territory_id,
                                owner_id: cell.owner_id,
                                owner_name: cell.owner_name,
                                is_locked: cell.is_locked,
                                cells: []
                            });
                        }
                        territoryMap.get(cell.territory_id).cells.push(cell);
                    }
                });

                // Calculate territory bounds and set display position
                territories.value = Array.from(territoryMap.values()).map(territory => {
                    const xs = territory.cells.map(c => c.x);
                    const ys = territory.cells.map(c => c.y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);
                    const maxX = Math.max(...xs);
                    const maxY = Math.max(...ys);

                    return {
                        ...territory,
                        bounds: { minX, minY, maxX, maxY },
                        displayX: minX,
                        displayY: minY
                    };
                });

                console.log('✅ Map data loaded');

            } catch (err) {
                console.error('❌ Error loading map data:', err);
                toast.show('เกิดข้อผิดพลาดในการโหลดข้อมูลแผนที่', 'error');
            }
        };

        // ===== MAP FUNCTIONS =====
        const selectMap = async (map) => {
            currentMap.value = map;
            await loadMapData();
        };

        const exitMap = () => {
            currentMap.value = null;
            cells.value = [];
            territories.value = [];
            adminMode.value = null;
            selectedCells.value = [];
        };

        // ===== CELL FUNCTIONS =====
        const onCellClick = (cell) => {
            if (adminMode.value === 'territory') {
                // Admin territory selection
                if (cell.owner_id) {
                    toast.show('ช่องนี้มีเจ้าของแล้ว', 'error');
                    return;
                }

                const index = selectedCells.value.findIndex(c => c.x === cell.x && c.y === cell.y);
                if (index > -1) {
                    selectedCells.value.splice(index, 1);
                } else {
                    selectedCells.value.push({ x: cell.x, y: cell.y });
                }
                return;
            }

            // Normal cell click
            activeCell.value = cell;
            showModal('cellDetail');
        };

        const getCellClass = (cell) => {
            const classes = {};

            // Selected cells (admin)
            if (selectedCells.value.some(c => c.x === cell.x && c.y === cell.y)) {
                classes['bg-green-500/20'] = true;
            }

            // Locked cells for others
            if (cell.owner_id && cell.owner_id !== profile.value?.id && cell.is_locked && !isAdmin.value) {
                classes['cell-locked-others'] = true;
            }

            // Admin view
            if (isAdmin.value && cell.owner_id) {
                classes['cell-admin-view'] = true;
            }

            // Owner borders
            if (cell.owner_id === profile.value?.id) {
                // Visual merging logic
                const neighbors = [
                    { x: cell.x + 1, y: cell.y }, // right
                    { x: cell.x - 1, y: cell.y }, // left
                    { x: cell.x, y: cell.y + 1 }, // bottom
                    { x: cell.x, y: cell.y - 1 }  // top
                ];

                const shouldShowBorder = (direction, neighborX, neighborY) => {
                    const neighbor = cells.value.find(c => c.x === neighborX && c.y === neighborY);
                    return !neighbor || neighbor.owner_id !== cell.owner_id;
                };

                if (shouldShowBorder('right', cell.x + 1, cell.y)) classes['border-r-owner'] = true;
                if (shouldShowBorder('left', cell.x - 1, cell.y)) classes['border-l-owner'] = true;
                if (shouldShowBorder('bottom', cell.x, cell.y + 1)) classes['border-b-owner'] = true;
                if (shouldShowBorder('top', cell.x, cell.y - 1)) classes['border-t-owner'] = true;
            }

            return classes;
        };

        // ===== CHARACTER FUNCTIONS =====
        const placeCharacter = async (cell) => {
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({
                        current_map_id: currentMap.value.id,
                        current_x: cell.x,
                        current_y: cell.y
                    })
                    .eq('id', profile.value.id);

                if (error) throw error;

                toast.show('วางตัวละครสำเร็จ!', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Place character error:', err);
                toast.show('เกิดข้อผิดพลาดในการวางตัวละคร', 'error');
            }
        };

        const removeCharacter = async () => {
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({
                        current_map_id: null,
                        current_x: null,
                        current_y: null
                    })
                    .eq('id', profile.value.id);

                if (error) throw error;

                toast.show('นำตัวละครออกแล้ว', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Remove character error:', err);
                toast.show('เกิดข้อผิดพลาดในการนำตัวละครออก', 'error');
            }
        };

        const toggleLock = async () => {
            try {
                const { error } = await supabaseClient
                    .from('territories')
                    .update({ is_locked: !activeCell.value.is_locked })
                    .eq('id', activeCell.value.territory_id);

                if (error) throw error;

                toast.show('เปลี่ยนสถานะการล็อคแล้ว', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Toggle lock error:', err);
                toast.show('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ', 'error');
            }
        };

        // ===== PROFILE FUNCTIONS =====
        const updateProfile = async () => {
            if (!profileForm.avatar_url.trim()) {
                toast.show('กรุณากรอก URL รูปภาพ', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ avatar_url: profileForm.avatar_url.trim() })
                    .eq('id', profile.value.id);

                if (error) throw error;

                toast.show('บันทึกโปรไฟล์สำเร็จ!', 'success');
                profile.value.avatar_url = profileForm.avatar_url.trim();
                closeModal();

            } catch (err) {
                console.error('Update profile error:', err);
                toast.show('เกิดข้อผิดพลาดในการบันทึกโปรไฟล์', 'error');
            }
        };

        // ===== ADMIN FUNCTIONS =====
        const validateConnectedCells = (cells) => {
            if (cells.length === 0) return false;
            if (cells.length === 1) return true;

            // Flood fill algorithm to check connectivity
            const visited = new Set();
            const queue = [cells[0]];
            visited.add(`${cells[0].x}-${cells[0].y}`);

            while (queue.length > 0) {
                const current = queue.shift();
                const neighbors = [
                    { x: current.x + 1, y: current.y },
                    { x: current.x - 1, y: current.y },
                    { x: current.x, y: current.y + 1 },
                    { x: current.x, y: current.y - 1 }
                ];

                for (const neighbor of neighbors) {
                    const key = `${neighbor.x}-${neighbor.y}`;
                    if (!visited.has(key) && cells.some(c => c.x === neighbor.x && c.y === neighbor.y)) {
                        visited.add(key);
                        queue.push(neighbor);
                    }
                }
            }

            return visited.size === cells.length;
        };

        const toggleTerritoryMode = () => {
            if (adminMode.value === 'territory') {
                adminMode.value = null;
                if (selectedCells.value.length > 0) {
                    showModal('assignTerritory');
                }
            } else {
                adminMode.value = 'territory';
                selectedCells.value = [];
            }
        };

        const assignTerritory = async () => {
            if (!territoryForm.ownerId) {
                toast.show('กรุณาเลือกผู้รับกรรมสิทธิ์', 'error');
                return;
            }

            if (!validateConnectedCells(selectedCells.value)) {
                toast.show('ช่องที่เลือกต้องติดกันทั้งหมด', 'error');
                return;
            }

            try {
                // Create territory
                const { data: territory, error: terrError } = await supabaseClient
                    .from('territories')
                    .insert({
                        map_id: currentMap.value.id,
                        owner_id: territoryForm.ownerId
                    })
                    .select()
                    .single();

                if (terrError) throw terrError;

                // Create territory cells
                const cellsToInsert = selectedCells.value.map(cell => ({
                    territory_id: territory.id,
                    x: cell.x,
                    y: cell.y
                }));

                const { error: cellError } = await supabaseClient
                    .from('territory_cells')
                    .insert(cellsToInsert);

                if (cellError) throw cellError;

                toast.show('มอบกรรมสิทธิ์สำเร็จ!', 'success');
                closeModal();
                adminMode.value = null;
                selectedCells.value = [];
                await loadMapData();

            } catch (err) {
                console.error('Assign territory error:', err);
                toast.show('เกิดข้อผิดพลาดในการมอบกรรมสิทธิ์', 'error');
            }
        };

        const revokeTerritory = async () => {
            if (!confirm('ต้องการถอนกรรมสิทธิ์ที่ดินใช่หรือไม่?')) return;

            try {
                const { error } = await supabaseClient
                    .from('territories')
                    .delete()
                    .eq('id', activeCell.value.territory_id);

                if (error) throw error;

                toast.show('ถอนกรรมสิทธิ์สำเร็จ', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Revoke territory error:', err);
                toast.show('เกิดข้อผิดพลาดในการถอนกรรมสิทธิ์', 'error');
            }
        };

        const adminMoveCharacter = async () => {
            if (!adminMoveForm.targetUserId) {
                toast.show('กรุณาเลือกตัวละคร', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({
                        current_map_id: currentMap.value.id,
                        current_x: activeCell.value.x,
                        current_y: activeCell.value.y
                    })
                    .eq('id', adminMoveForm.targetUserId);

                if (error) throw error;

                toast.show('ย้ายตัวละครสำเร็จ (Admin)', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Admin move error:', err);
                toast.show('เกิดข้อผิดพลาดในการย้ายตัวละคร', 'error');
            }
        };

        const saveDecoration = async () => {
            if (!decoForm.userId) {
                toast.show('กรุณาเลือกผู้ใช้', 'error');
                return;
            }

            try {
                let decorationId = null;

                if (decoForm.decoId !== 'none') {
                    const decorationData = {
                        name: decoForm.decoId === 'glow' ? 'Glow Effect' : 'Frame Effect',
                        type: decoForm.decoId,
                        style_config: decoForm.decoId === 'glow' ? { color: decoForm.glowColor } : {}
                    };

                    // Check if decoration exists
                    const { data: existingDeco } = await supabaseClient
                        .from('decorations')
                        .select('id')
                        .eq('type', decoForm.decoId)
                        .eq('style_config', JSON.stringify(decorationData.style_config))
                        .single();

                    if (existingDeco) {
                        decorationId = existingDeco.id;
                    } else {
                        const { data: newDeco, error: decoError } = await supabaseClient
                            .from('decorations')
                            .insert(decorationData)
                            .select()
                            .single();

                        if (decoError) throw decoError;
                        decorationId = newDeco.id;
                    }
                }

                // Update profile
                const { error: profileError } = await supabaseClient
                    .from('profiles')
                    .update({ decoration_id: decorationId })
                    .eq('id', decoForm.userId);

                if (profileError) throw profileError;

                toast.show('บันทึกตกแต่งสำเร็จ!', 'success');
                closeModal();
                await loadMapData();

            } catch (err) {
                console.error('Save decoration error:', err);
                toast.show('เกิดข้อผิดพลาดในการบันทึกตกแต่ง', 'error');
            }
        };

        // ===== MAP MANAGEMENT =====
        const editMap = (map) => {
            mapForm.id = map.id;
            mapForm.name = map.name;
            mapForm.description = map.description;
            mapForm.image_url = map.image_url;
            showModal('editMap');
        };

        const deleteMap = async () => {
            if (!mapToDelete.value) return;

            try {
                const { error } = await supabaseClient
                    .from('maps')
                    .update({ is_deleted: true })
                    .eq('id', mapToDelete.value.id);

                if (error) throw error;

                toast.show('ลบแผนที่สำเร็จ', 'success');
                mapToDelete.value = null;
                closeModal();
                await loadAppData();

            } catch (err) {
                console.error('Delete map error:', err);
                toast.show('เกิดข้อผิดพลาดในการลบแผนที่', 'error');
            }
        };

        const addMap = async () => {
            if (!mapForm.name || !mapForm.image_url) {
                toast.show('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('maps')
                    .insert({
                        name: mapForm.name,
                        description: mapForm.description,
                        image_url: mapForm.image_url
                    });

                if (error) throw error;

                toast.show('เพิ่มแผนที่สำเร็จ!', 'success');
                resetMapForm();
                showAddMapForm.value = false;
                await loadAppData();

            } catch (err) {
                console.error('Add map error:', err);
                toast.show('เกิดข้อผิดพลาดในการเพิ่มแผนที่', 'error');
            }
        };

        const updateMap = async () => {
            if (!mapForm.name || !mapForm.image_url) {
                toast.show('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('maps')
                    .update({
                        name: mapForm.name,
                        description: mapForm.description,
                        image_url: mapForm.image_url
                    })
                    .eq('id', mapForm.id);

                if (error) throw error;

                toast.show('แก้ไขแผนที่สำเร็จ!', 'success');
                closeModal();
                resetMapForm();
                await loadAppData();

            } catch (err) {
                console.error('Update map error:', err);
                toast.show('เกิดข้อผิดพลาดในการแก้ไขแผนที่', 'error');
            }
        };

        const resetMapForm = () => {
            mapForm.id = null;
            mapForm.name = '';
            mapForm.description = '';
            mapForm.image_url = '';
        };

        const openModal = (modalName) => {
            showModal(modalName);
        };

        const confirmDeleteMap = (map) => {
            mapToDelete.value = map;
            showModal('deleteMap');
        };

        // ===== LIFECYCLE =====
        const retryLoad = async () => {
            error.value = null;
            loading.value = true;
            loadingMessage.value = 'กำลังโหลดใหม่...';
            await loadAppData();
        };

        onMounted(async () => {
            try {
                console.log('🎯 App mounted, loading data...');
                await loadAppData();
            } catch (err) {
                console.error('❌ Mount error:', err);
                error.value = err.message || 'เกิดข้อผิดพลาดในการเริ่มต้นแอพ';
            } finally {
                loading.value = false;
            }
        });

        // ===== RETURN =====
        return {
            // State
            loading,
            loadingMessage,
            error,
            user,
            profile,
            maps,
            currentMap,
            cells,
            territories,
            activeModal,
            activeCell,
            adminMode,
            selectedCells,
            allProfiles,
            showAddMapForm,
            selectedOwner,
            toastState,

            // Forms
            loginForm,
            profileForm,
            decoForm,
            territoryForm,
            adminMoveForm,
            mapForm,

            // Computed
            isAdmin,
            canJoinCell,
            isMyCharacterHere,
            isMyTerritory,

            // Functions
            handleImageError,
            showOwnerDetail,
            showModal,
            closeModal,
            login,
            logout,
            selectMap,
            exitMap,
            onCellClick,
            getCellClass,
            placeCharacter,
            removeCharacter,
            toggleLock,
            updateProfile,
            toggleTerritoryMode,
            assignTerritory,
            revokeTerritory,
            adminMoveCharacter,
            saveDecoration,
            editMap,
            deleteMap,
            addMap,
            updateMap,
            resetMapForm,
            openModal,
            confirmDeleteMap,
            retryLoad
        };
    }
}).mount('#app');

console.log('✅ Vue app initialized');