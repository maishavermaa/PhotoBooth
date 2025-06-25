class PhotoBooth {
    constructor() {
        this.currentFilter = 'none';
        this.photos = this.loadPhotosFromStorage();
        this.selectedPhotos = [];
        this.selectedForStrip = [];
        this.currentTemplate = 'vertical';
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isStreamActive = false;
        this.currentEditingPhoto = null;
        this.originalEditImage = null;
        this.isSelectingForSlot = false;
        this.currentSlotIndex = -1;
        
        // Strip customization settings
        this.stripSettings = {
            backgroundColor: '#ffffff',
            borderColor: '#3498db',
            textColor: '#2c3e50',
            customTitle: 'PhotoBooth Memories',
            textBoxes: [], // Array to store multiple text boxes
            stickers: [], // Array to store emoji/sticker elements
            titleX: 50,
            titleY: 10,
            titleRotation: 0, // Title rotation
            showDate: true,
            showBorder: true
        };
        
        this.textBoxCounter = 0; // Counter for unique text box IDs
        this.stickerCounter = 0; // Counter for unique sticker IDs
        
        console.log('PhotoBooth initialized with', this.photos.length, 'photos');
        this.init();
    }

    loadPhotosFromStorage() {
        try {
            const stored = localStorage.getItem('photoboothPhotos');
            if (stored) {
                const photos = JSON.parse(stored);
                console.log('Loaded', photos.length, 'photos from storage');
                return photos;
            }
        } catch (error) {
            console.error('Error loading photos from storage:', error);
        }
        return [];
    }

    async init() {
        this.setupEventListeners();
        this.loadGallery();
        await this.setupCamera();
        this.updateStripGallery();
        this.setupStripSlots();
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('cameraMode').addEventListener('click', () => this.switchMode('camera'));
        document.getElementById('galleryMode').addEventListener('click', () => this.switchMode('gallery'));
        document.getElementById('stripMode').addEventListener('click', () => this.switchMode('strip'));

        // Camera controls
        document.getElementById('captureBtn').addEventListener('click', () => this.capturePhoto());
        
        // Filter controls for camera
        document.querySelectorAll('.camera-controls .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyFilter(e.target.dataset.filter));
        });

        // Gallery controls
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAllPhotos());
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelectedPhotos());

        // Strip controls
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectTemplate(e.target.dataset.template));
        });
        document.getElementById('downloadStripBtn').addEventListener('click', () => this.downloadStrip());

        // Modal controls
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('saveEditBtn').addEventListener('click', () => this.savePhotoEdit());
        document.getElementById('downloadPhotoBtn').addEventListener('click', () => this.downloadCurrentPhoto());
        document.getElementById('cancelEditBtn').addEventListener('click', () => this.closeModal());

        // Close modal on outside click
        document.getElementById('photoModal').addEventListener('click', (e) => {
            if (e.target.id === 'photoModal') this.closeModal();
        });

        // Customization controls
        this.setupCustomizationListeners();
    }

    setupCustomizationListeners() {
        // Color pickers
        document.getElementById('backgroundColorPicker').addEventListener('change', (e) => {
            this.stripSettings.backgroundColor = e.target.value;
            this.updateStripPreview();
        });

        document.getElementById('borderColorPicker').addEventListener('change', (e) => {
            this.stripSettings.borderColor = e.target.value;
            this.updateStripPreview();
        });

        document.getElementById('textColorPicker').addEventListener('change', (e) => {
            this.stripSettings.textColor = e.target.value;
            this.updateStripPreview();
            this.updateDraggableTextColors();
        });

        // Custom title
        document.getElementById('stripTitle').addEventListener('input', (e) => {
            this.stripSettings.customTitle = e.target.value || 'PhotoBooth Memories';
            this.updateStripPreview();
            this.updateDraggableText();
        });

        // Add text box button
        document.getElementById('addTextBoxBtn').addEventListener('click', () => {
            this.addTextBox();
        });

        // Toggle options
        document.getElementById('showDate').addEventListener('change', (e) => {
            this.stripSettings.showDate = e.target.checked;
            this.updateStripPreview();
        });

        document.getElementById('showBorder').addEventListener('change', (e) => {
            this.stripSettings.showBorder = e.target.checked;
            this.updateStripPreview();
        });

        // Sticker buttons
        document.querySelectorAll('.sticker-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.addSticker(e.target.dataset.sticker);
            });
        });
    }

    addTextBox() {
        const textBoxId = `textBox_${this.textBoxCounter++}`;
        const textBox = {
            id: textBoxId,
            text: '',
            x: 50,
            y: 50 + (this.stripSettings.textBoxes.length * 10), // Offset each new text box
            rotation: 0 // Text rotation
        };
        
        this.stripSettings.textBoxes.push(textBox);
        this.createTextBoxUI(textBox);
        this.updateStripPreview();
        this.updateDraggableText();
    }

    createTextBoxUI(textBox) {
        const textBoxesList = document.getElementById('textBoxesList');
        const textBoxItem = document.createElement('div');
        textBoxItem.className = 'text-box-item';
        textBoxItem.dataset.textBoxId = textBox.id;
        
        textBoxItem.innerHTML = `
            <input type="text" placeholder="Enter text..." maxlength="50" value="${textBox.text}">
            <button type="button" class="remove-text-btn">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        // Add event listeners
        const input = textBoxItem.querySelector('input');
        const removeBtn = textBoxItem.querySelector('.remove-text-btn');
        
        input.addEventListener('input', (e) => {
            textBox.text = e.target.value;
            this.updateStripPreview();
            this.updateDraggableText();
        });
        
        removeBtn.addEventListener('click', () => {
            this.removeTextBox(textBox.id);
        });
        
        textBoxesList.appendChild(textBoxItem);
    }

    removeTextBox(textBoxId) {
        // Remove from settings
        this.stripSettings.textBoxes = this.stripSettings.textBoxes.filter(tb => tb.id !== textBoxId);
        
        // Remove from UI
        const textBoxItem = document.querySelector(`[data-text-box-id="${textBoxId}"]`);
        if (textBoxItem) {
            textBoxItem.remove();
        }
        
        // Remove draggable element
        const draggableElement = document.querySelector(`.draggable-text[data-type="${textBoxId}"]`);
        if (draggableElement) {
            draggableElement.remove();
        }
        
        this.updateStripPreview();
    }

    setupStripSlots() {
        // Setup clickable slots for photo selection
        document.querySelectorAll('.selected-slot').forEach((slot, index) => {
            slot.addEventListener('click', () => this.handleSlotClick(index));
        });
    }

    handleSlotClick(slotIndex) {
        const slot = document.querySelector(`[data-slot="${slotIndex}"]`);
        
        if (slot.classList.contains('filled')) {
            // Deselect the photo
            this.deselectPhotoFromStrip(slotIndex);
        } else {
            // Start photo selection for this slot
            this.startPhotoSelection(slotIndex);
        }
    }

    startPhotoSelection(slotIndex) {
        this.isSelectingForSlot = true;
        this.currentSlotIndex = slotIndex;
        
        // Highlight the slot being filled
        document.querySelectorAll('.selected-slot').forEach(s => s.classList.remove('selecting'));
        document.querySelector(`[data-slot="${slotIndex}"]`).classList.add('selecting');
        
        // Highlight available photos
        document.getElementById('stripGalleryGrid').style.border = '3px solid #3498db';
        document.getElementById('stripGalleryGrid').style.borderRadius = '15px';
        
        // Show instruction
        this.showNotification(`Click on a photo below to select it for slot ${slotIndex + 1}`, 'info');
        
        // Scroll to gallery
        document.getElementById('stripGalleryGrid').scrollIntoView({ behavior: 'smooth' });
    }

    deselectPhotoFromStrip(slotIndex) {
        // Remove photo from selected array
        this.selectedForStrip.splice(slotIndex, 1);
        
        // Clear all slots and refill
        this.clearAllSlots();
        this.selectedForStrip.forEach((photo, index) => {
            this.fillSlot(index, photo);
        });
        
        // Update strip preview
        this.updateStripPreview();
        
        this.showNotification(`Photo removed from slot ${slotIndex + 1}`);
    }

    clearAllSlots() {
        document.querySelectorAll('.selected-slot').forEach(slot => {
            slot.classList.remove('filled', 'selecting');
            slot.innerHTML = `
                <i class="fas fa-plus"></i>
                <span>Click to select photo</span>
            `;
        });
    }

    fillSlot(slotIndex, photo) {
        const slot = document.querySelector(`[data-slot="${slotIndex}"]`);
        slot.classList.add('filled');
        slot.classList.remove('selecting');
        slot.innerHTML = `<img src="${photo.data}" alt="Selected photo">`;
    }

    setupEditEventListeners() {
        console.log('Setting up edit event listeners');
        
        // Photo editor sliders
        const brightnessSlider = document.getElementById('brightnessSlider');
        const contrastSlider = document.getElementById('contrastSlider');
        const saturationSlider = document.getElementById('saturationSlider');

        // Remove existing listeners to avoid duplicates
        brightnessSlider.removeEventListener('input', this.updatePhotoEdit);
        contrastSlider.removeEventListener('input', this.updatePhotoEdit);
        saturationSlider.removeEventListener('input', this.updatePhotoEdit);

        // Add new listeners
        brightnessSlider.addEventListener('input', (e) => {
            console.log('Brightness changed to:', e.target.value);
            this.updatePhotoEdit();
        });
        
        contrastSlider.addEventListener('input', (e) => {
            console.log('Contrast changed to:', e.target.value);
            this.updatePhotoEdit();
        });
        
        saturationSlider.addEventListener('input', (e) => {
            console.log('Saturation changed to:', e.target.value);
            this.updatePhotoEdit();
        });

        // Modal filter buttons
        document.querySelectorAll('.modal .filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Modal filter clicked:', e.target.dataset.filter);
                this.applyEditFilter(e.target.dataset.filter);
            });
        });
    }

    async setupCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            });
            this.video.srcObject = stream;
            this.isStreamActive = true;
            
            this.video.addEventListener('loadedmetadata', () => {
                this.canvas.width = this.video.videoWidth;
                this.canvas.height = this.video.videoHeight;
            });
        } catch (err) {
            console.error('Error accessing camera:', err);
            this.showNotification('Camera access denied or not available', 'error');
        }
    }

    switchMode(mode) {
        // Update buttons
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(mode + 'Mode').classList.add('active');

        // Update sections
        document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
        document.getElementById(mode + 'Section').classList.add('active');

        // Reset selection state when switching modes
        this.isSelectingForSlot = false;
        this.currentSlotIndex = -1;
        document.querySelectorAll('.selected-slot').forEach(s => s.classList.remove('selecting'));
        document.getElementById('stripGalleryGrid').style.border = 'none';

        // Setup camera when switching to camera mode
        if (mode === 'camera' && !this.isStreamActive) {
            this.setupCamera();
        }
    }

    applyFilter(filter) {
        this.currentFilter = filter;
        
        // Update filter buttons
        document.querySelectorAll('.camera-controls .filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Apply filter to video
        this.video.className = `filter-${filter}`;
        
        // Apply filter to overlay if needed
        const overlay = document.getElementById('filterOverlay');
        overlay.className = `filter-overlay filter-${filter}`;
    }

    capturePhoto() {
        if (!this.isStreamActive) {
            this.showNotification('Camera not available', 'error');
            return;
        }

        console.log('Capturing photo...');
        
        // Draw video frame to canvas with current filter
        this.ctx.filter = this.getFilterCSS(this.currentFilter);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Convert to base64 data URL for persistence
        const dataURL = this.canvas.toDataURL('image/jpeg', 0.9);
        console.log('Photo data URL length:', dataURL.length);
        
        const photo = {
            id: Date.now(),
            data: dataURL,
            timestamp: new Date().toISOString(),
            filter: this.currentFilter
        };
        
        this.photos.unshift(photo);
        console.log('Photo added, total photos:', this.photos.length);
        
        this.savePhotos();
        this.loadGallery();
        this.updateStripGallery();
        this.showNotification('Photo captured successfully!');
        
        // Add capture animation
        this.addCaptureAnimation();
    }

    addCaptureAnimation() {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            z-index: 9999;
            opacity: 0.8;
            pointer-events: none;
        `;
        document.body.appendChild(flash);
        
        setTimeout(() => {
            flash.style.opacity = '0';
            flash.style.transition = 'opacity 0.3s';
            setTimeout(() => document.body.removeChild(flash), 300);
        }, 100);
    }

    getFilterCSS(filter) {
        const filters = {
            'none': 'none',
            'grayscale': 'grayscale(100%)',
            'sepia': 'sepia(100%)',
            'blur': 'blur(2px)',
            'brightness': 'brightness(1.5)',
            'contrast': 'contrast(1.5)',
            'vintage': 'sepia(50%) contrast(1.2) brightness(1.1) saturate(1.3)'
        };
        return filters[filter] || 'none';
    }

    loadGallery() {
        const gallery = document.getElementById('galleryGrid');
        gallery.innerHTML = '';

        console.log('Loading gallery with', this.photos.length, 'photos');

        if (this.photos.length === 0) {
            gallery.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">No photos yet. Take some pictures!</p>';
            return;
        }

        this.photos.forEach(photo => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.dataset.photoId = photo.id;
            
            photoItem.innerHTML = `
                <img src="${photo.data}" alt="Photo ${photo.id}">
                <div class="photo-actions">
                    <button class="action-btn edit-btn" data-photo-id="${photo.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="action-btn download-btn" data-photo-id="${photo.id}">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="action-btn delete-btn" data-photo-id="${photo.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `;

            // Add event listeners for action buttons
            const editBtn = photoItem.querySelector('.edit-btn');
            const downloadBtn = photoItem.querySelector('.download-btn');
            const deleteBtn = photoItem.querySelector('.delete-btn');

            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editPhoto(photo.id);
            });

            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadPhoto(photo.id);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePhoto(photo.id);
            });

            // Add selection functionality
            photoItem.addEventListener('click', (e) => {
                if (!e.target.closest('.photo-actions')) {
                    this.togglePhotoSelection(photo.id);
                }
            });

            gallery.appendChild(photoItem);
        });
    }

    updateStripGallery() {
        const gallery = document.getElementById('stripGalleryGrid');
        gallery.innerHTML = '';

        if (this.photos.length === 0) {
            gallery.innerHTML = '<p style="text-align: center; color: #7f8c8d; grid-column: 1/-1;">Take some photos first!</p>';
            return;
        }

        this.photos.forEach(photo => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';
            photoItem.dataset.photoId = photo.id;
            
            photoItem.innerHTML = `<img src="${photo.data}" alt="Photo ${photo.id}">`;
            
            photoItem.addEventListener('click', () => {
                if (this.isSelectingForSlot) {
                    this.selectPhotoForSlot(photo);
                } else {
                    if (this.selectedForStrip.length < 3 && !this.isPhotoInStrip(photo)) {
                        this.addToStripSelection(photo);
                    } else if (this.isPhotoInStrip(photo)) {
                        this.showNotification('Photo already selected for strip', 'error');
                    } else {
                        this.showNotification('Maximum 3 photos allowed. Click on a slot to replace a photo.', 'error');
                    }
                }
            });

            gallery.appendChild(photoItem);
        });
    }

    isPhotoInStrip(photo) {
        return this.selectedForStrip.some(selected => selected.id === photo.id);
    }

    selectPhotoForSlot(photo) {
        if (this.currentSlotIndex >= 0 && this.currentSlotIndex < 3) {
            // Replace photo at specific slot
            this.selectedForStrip[this.currentSlotIndex] = photo;
            this.fillSlot(this.currentSlotIndex, photo);
            
            // Reset selection state
            this.isSelectingForSlot = false;
            this.currentSlotIndex = -1;
            document.querySelectorAll('.selected-slot').forEach(s => s.classList.remove('selecting'));
            document.getElementById('stripGalleryGrid').style.border = 'none';
            
            this.showNotification('Photo selected!');
            this.updateStripPreview();
        }
    }

    togglePhotoSelection(photoId) {
        const photoItem = document.querySelector(`[data-photo-id="${photoId}"]`);
        const index = this.selectedPhotos.indexOf(photoId);
        
        if (index > -1) {
            this.selectedPhotos.splice(index, 1);
            photoItem.classList.remove('selected');
        } else {
            this.selectedPhotos.push(photoId);
            photoItem.classList.add('selected');
        }
    }

    selectAllPhotos() {
        const allSelected = this.selectedPhotos.length === this.photos.length;
        
        if (allSelected) {
            this.selectedPhotos = [];
            document.querySelectorAll('#galleryGrid .photo-item').forEach(item => {
                item.classList.remove('selected');
            });
        } else {
            this.selectedPhotos = this.photos.map(photo => photo.id);
            document.querySelectorAll('#galleryGrid .photo-item').forEach(item => {
                item.classList.add('selected');
            });
        }
    }

    deleteSelectedPhotos() {
        if (this.selectedPhotos.length === 0) {
            this.showNotification('No photos selected', 'error');
            return;
        }

        if (confirm(`Delete ${this.selectedPhotos.length} selected photo(s)?`)) {
            this.photos = this.photos.filter(photo => !this.selectedPhotos.includes(photo.id));
            this.selectedPhotos = [];
            this.savePhotos();
            this.loadGallery();
            this.updateStripGallery();
            this.showNotification('Selected photos deleted');
        }
    }

    deletePhoto(photoId) {
        if (confirm('Delete this photo?')) {
            this.photos = this.photos.filter(photo => photo.id != photoId);
            this.selectedPhotos = this.selectedPhotos.filter(id => id != photoId);
            this.savePhotos();
            this.loadGallery();
            this.updateStripGallery();
            this.showNotification('Photo deleted');
        }
    }

    editPhoto(photoId) {
        console.log('Opening edit for photo:', photoId);
        const photo = this.photos.find(p => p.id == photoId);
        if (!photo) {
            console.error('Photo not found:', photoId);
            return;
        }

        this.currentEditingPhoto = photo;
        const modal = document.getElementById('photoModal');
        const editCanvas = document.getElementById('editCanvas');
        const editCtx = editCanvas.getContext('2d');

        // Show modal first
        modal.classList.add('active');

        // Load photo into edit canvas and store original
        const img = new Image();
        img.onload = () => {
            console.log('Image loaded for editing, size:', img.width, 'x', img.height);
            editCanvas.width = img.width;
            editCanvas.height = img.height;
            this.originalEditImage = img;
            editCtx.drawImage(img, 0, 0);
            
            // Reset sliders and filter buttons
            document.getElementById('brightnessSlider').value = 0;
            document.getElementById('contrastSlider').value = 0;
            document.getElementById('saturationSlider').value = 0;
            
            // Reset modal filter buttons
            document.querySelectorAll('.modal .filter-btn').forEach(btn => btn.classList.remove('active'));
            const noneBtn = document.querySelector('.modal .filter-btn[data-filter="none"]');
            if (noneBtn) noneBtn.classList.add('active');
            
            // Setup event listeners for this modal session
            this.setupEditEventListeners();
            
            console.log('Edit setup complete');
        };
        img.src = photo.data;
    }

    applyEditFilter(filter) {
        console.log('Applying edit filter:', filter);
        
        // Update modal filter buttons
        document.querySelectorAll('.modal .filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        
        // Apply filter and redraw
        this.updatePhotoEdit();
    }

    updatePhotoEdit() {
        console.log('updatePhotoEdit called');
        
        if (!this.currentEditingPhoto) {
            console.log('No current editing photo');
            return;
        }
        
        if (!this.originalEditImage) {
            console.log('No original edit image');
            return;
        }

        const editCanvas = document.getElementById('editCanvas');
        const editCtx = editCanvas.getContext('2d');
        
        const brightness = parseInt(document.getElementById('brightnessSlider').value);
        const contrast = parseInt(document.getElementById('contrastSlider').value);
        const saturation = parseInt(document.getElementById('saturationSlider').value);

        console.log('Slider values - B:', brightness, 'C:', contrast, 'S:', saturation);

        // Get selected filter
        const activeFilterBtn = document.querySelector('.modal .filter-btn.active');
        const selectedFilter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'none';
        console.log('Selected filter:', selectedFilter);

        // Combine filter and adjustments
        let filter = this.getFilterCSS(selectedFilter);
        if (brightness !== 0 || contrast !== 0 || saturation !== 0) {
            const adjustments = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
            filter = filter === 'none' ? adjustments : `${filter} ${adjustments}`;
        }

        console.log('Final filter:', filter);

        // Clear canvas and apply filter
        editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
        editCtx.filter = filter;
        editCtx.drawImage(this.originalEditImage, 0, 0);
        
        // Reset filter for future operations
        editCtx.filter = 'none';
        
        console.log('Canvas updated');
    }

    savePhotoEdit() {
        if (!this.currentEditingPhoto) return;

        const editCanvas = document.getElementById('editCanvas');
        const dataURL = editCanvas.toDataURL('image/jpeg', 0.9);
        
        // Update photo in array
        const photo = this.photos.find(p => p.id == this.currentEditingPhoto.id);
        if (photo) {
            photo.data = dataURL;
            this.savePhotos();
            this.loadGallery();
            this.updateStripGallery();
            this.showNotification('Photo saved successfully!');
        }
        
        this.closeModal();
    }

    downloadPhoto(photoId) {
        const photo = this.photos.find(p => p.id == photoId);
        if (!photo) return;

        const link = document.createElement('a');
        link.href = photo.data;
        link.download = `photobooth-${photo.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Photo downloaded!');
    }

    downloadCurrentPhoto() {
        if (!this.currentEditingPhoto) return;

        const editCanvas = document.getElementById('editCanvas');
        const dataURL = editCanvas.toDataURL('image/jpeg', 0.9);
        
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `photobooth-edited-${this.currentEditingPhoto.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('Edited photo downloaded!');
    }

    selectTemplate(template) {
        this.currentTemplate = template;
        
        // Update template buttons
        document.querySelectorAll('.template-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-template="${template}"]`).classList.add('active');
        
        // Update strip preview if photos are selected
        this.updateStripPreview();
    }

    addToStripSelection(photo) {
        if (this.selectedForStrip.length >= 3) return;

        this.selectedForStrip.push(photo);
        this.fillSlot(this.selectedForStrip.length - 1, photo);
        this.updateStripPreview();
        this.showNotification(`Photo added to slot ${this.selectedForStrip.length}`);
    }

    async updateStripPreview() {
        if (this.selectedForStrip.length === 3) {
            try {
                const canvas = document.getElementById('stripCanvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas dimensions based on template
                this.setStripDimensions(canvas);
                
                // Clear canvas
                ctx.fillStyle = this.stripSettings.backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw the strip
                await this.drawStripTemplate(ctx, canvas.width, canvas.height);
                
                // Create/update draggable text elements
                this.createDraggableTextElements();
                
                // Enable download button
                document.getElementById('downloadStripBtn').disabled = false;
                this.showNotification('Photo strip ready for download!');
            } catch (error) {
                console.error('Error generating strip:', error);
                this.showNotification('Error generating strip', 'error');
            }
        } else {
            document.getElementById('downloadStripBtn').disabled = true;
            this.clearDraggableText();
        }
    }

    setStripDimensions(canvas) {
        switch (this.currentTemplate) {
            case 'vertical':
                canvas.width = 300;
                canvas.height = 800;
                break;
            case 'horizontal':
                canvas.width = 800;
                canvas.height = 300;
                break;
            case 'collage':
            case 'fancy':
                canvas.width = 600;
                canvas.height = 600;
                break;
        }
    }

    async drawStripTemplate(ctx, width, height) {
        const photos = this.selectedForStrip;
        const padding = 20;
        
        // Apply background color
        ctx.fillStyle = this.stripSettings.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        switch (this.currentTemplate) {
            case 'vertical':
                await this.drawVerticalStrip(ctx, photos, width, height, padding);
                break;
            case 'horizontal':
                await this.drawHorizontalStrip(ctx, photos, width, height, padding);
                break;
            case 'collage':
                await this.drawCollageStrip(ctx, photos, width, height, padding);
                break;
            case 'fancy':
                await this.drawFancyStrip(ctx, photos, width, height, padding);
                break;
        }
    }

    async drawStripTemplateForDownload(ctx, width, height) {
        const photos = this.selectedForStrip;
        const padding = 20;
        
        // Apply background color
        ctx.fillStyle = this.stripSettings.backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        switch (this.currentTemplate) {
            case 'vertical':
                await this.drawVerticalStripForDownload(ctx, photos, width, height, padding);
                break;
            case 'horizontal':
                await this.drawHorizontalStripForDownload(ctx, photos, width, height, padding);
                break;
            case 'collage':
                await this.drawCollageStripForDownload(ctx, photos, width, height, padding);
                break;
            case 'fancy':
                await this.drawFancyStripForDownload(ctx, photos, width, height, padding);
                break;
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    async drawVerticalStrip(ctx, photos, width, height, padding) {
        const photoHeight = (height - 4 * padding) / 3;
        const photoWidth = width - 2 * padding;
        
        // Add border if enabled
        if (this.stripSettings.showBorder) {
            ctx.strokeStyle = this.stripSettings.borderColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, width - 4, height - 4);
        }
        
        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index];
            try {
                const img = await this.loadImage(photo.data);
                const y = padding + index * (photoHeight + padding);
                
                // Add photo border if enabled
                if (this.stripSettings.showBorder) {
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(padding - 2, y - 2, photoWidth + 4, photoHeight + 4);
                }
                
                ctx.drawImage(img, padding, y, photoWidth, photoHeight);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }

    async drawVerticalStripForDownload(ctx, photos, width, height, padding) {
        await this.drawVerticalStrip(ctx, photos, width, height, padding);
        this.addTextToStrip(ctx, width, height);
    }

    async drawHorizontalStrip(ctx, photos, width, height, padding) {
        const photoWidth = (width - 4 * padding) / 3;
        const photoHeight = height - 2 * padding;
        
        // Add border if enabled
        if (this.stripSettings.showBorder) {
            ctx.strokeStyle = this.stripSettings.borderColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, width - 4, height - 4);
        }
        
        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index];
            try {
                const img = await this.loadImage(photo.data);
                const x = padding + index * (photoWidth + padding);
                
                // Add photo border if enabled
                if (this.stripSettings.showBorder) {
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x - 2, padding - 2, photoWidth + 4, photoHeight + 4);
                }
                
                ctx.drawImage(img, x, padding, photoWidth, photoHeight);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }

    async drawHorizontalStripForDownload(ctx, photos, width, height, padding) {
        await this.drawHorizontalStrip(ctx, photos, width, height, padding);
        this.addTextToStrip(ctx, width, height);
    }

    async drawCollageStrip(ctx, photos, width, height, padding) {
        const positions = [
            { x: padding, y: padding, w: width - 2 * padding, h: height / 2 - 1.5 * padding },
            { x: padding, y: height / 2 + padding / 2, w: width / 2 - 1.5 * padding, h: height / 2 - 1.5 * padding },
            { x: width / 2 + padding / 2, y: height / 2 + padding / 2, w: width / 2 - 1.5 * padding, h: height / 2 - 1.5 * padding }
        ];
        
        // Add border if enabled
        if (this.stripSettings.showBorder) {
            ctx.strokeStyle = this.stripSettings.borderColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, width - 4, height - 4);
        }
        
        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index];
            try {
                const img = await this.loadImage(photo.data);
                const pos = positions[index];
                
                // Add photo border if enabled
                if (this.stripSettings.showBorder) {
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(pos.x - 2, pos.y - 2, pos.w + 4, pos.h + 4);
                }
                
                ctx.drawImage(img, pos.x, pos.y, pos.w, pos.h);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }

    async drawCollageStripForDownload(ctx, photos, width, height, padding) {
        await this.drawCollageStrip(ctx, photos, width, height, padding);
        this.addTextToStrip(ctx, width, height);
    }

    async drawFancyStrip(ctx, photos, width, height, padding) {
        // Add decorative border if enabled
        if (this.stripSettings.showBorder) {
            ctx.strokeStyle = this.stripSettings.borderColor;
            ctx.lineWidth = 8;
            ctx.strokeRect(4, 4, width - 8, height - 8);
        }
        
        // Draw photos in a fancy arrangement
        const photoSize = 160;
        const positions = [
            { x: width / 2 - photoSize / 2, y: 70 },
            { x: width / 4 - photoSize / 2, y: 280 },
            { x: 3 * width / 4 - photoSize / 2, y: 280 }
        ];
        
        for (let index = 0; index < photos.length; index++) {
            const photo = photos[index];
            try {
                const img = await this.loadImage(photo.data);
                const pos = positions[index];
                
                // Add photo border
                ctx.fillStyle = 'white';
                ctx.fillRect(pos.x - 5, pos.y - 5, photoSize + 10, photoSize + 10);
                if (this.stripSettings.showBorder) {
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(pos.x - 5, pos.y - 5, photoSize + 10, photoSize + 10);
                }
                
                // Draw photo
                ctx.drawImage(img, pos.x, pos.y, photoSize, photoSize);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }
    }

    async drawFancyStripForDownload(ctx, photos, width, height, padding) {
        await this.drawFancyStrip(ctx, photos, width, height, padding);
        this.addTextToStrip(ctx, width, height);
    }

    addTextToStrip(ctx, width, height) {
        // Add title if it exists
        if (this.stripSettings.customTitle) {
            ctx.save();
            const titleX = (this.stripSettings.titleX / 100) * width;
            const titleY = (this.stripSettings.titleY / 100) * height;
            
            ctx.translate(titleX, titleY);
            ctx.rotate((this.stripSettings.titleRotation * Math.PI) / 180);
            
            ctx.fillStyle = this.stripSettings.textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(this.stripSettings.customTitle, 0, 0);
            ctx.restore();
        }
        
        // Add all text boxes
        this.stripSettings.textBoxes.forEach(textBox => {
            if (textBox.text) {
                ctx.save();
                const textX = (textBox.x / 100) * width;
                const textY = (textBox.y / 100) * height;
                
                ctx.translate(textX, textY);
                ctx.rotate((textBox.rotation * Math.PI) / 180);
                
                ctx.fillStyle = this.stripSettings.textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '18px Arial';
                ctx.fillText(textBox.text, 0, 0);
                ctx.restore();
            }
        });
        
        // Add all stickers
        this.stripSettings.stickers.forEach(sticker => {
            ctx.save(); // Save current context state
            
            const stickerX = (sticker.x / 100) * width;
            const stickerY = (sticker.y / 100) * height;
            
            // Move to sticker position and rotate
            ctx.translate(stickerX, stickerY);
            ctx.rotate((sticker.rotation * Math.PI) / 180);
            
            // Set font and draw emoji at origin (0,0) since we've translated
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${sticker.size}px Arial`;
            ctx.fillText(sticker.emoji, 0, 0);
            
            ctx.restore(); // Restore context state
        });
        
        // Add date if enabled
        if (this.stripSettings.showDate) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 14px Arial';
            const dateY = height - 25;
            const dateText = new Date().toLocaleDateString();
            const dateX = width / 2; // Center horizontally
            
            // Measure text for background sizing
            const textMetrics = ctx.measureText(dateText);
            const textWidth = textMetrics.width;
            const padding = 8;
            const backgroundWidth = textWidth + (padding * 2);
            const backgroundHeight = 20;
            const backgroundX = dateX - (backgroundWidth / 2);
            const backgroundY = dateY - 16;
            
            // Draw label background with border
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
            
            // Draw border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.lineWidth = 1;
            ctx.strokeRect(backgroundX, backgroundY, backgroundWidth, backgroundHeight);
            
            // Draw the date text centered
            ctx.fillStyle = this.stripSettings.textColor;
            ctx.fillText(dateText, dateX, dateY);
        }
    }

    downloadStrip() {
        // Create a temporary canvas for download with text
        const downloadCanvas = document.createElement('canvas');
        const downloadCtx = downloadCanvas.getContext('2d');
        
        // Set canvas dimensions based on template
        this.setStripDimensions(downloadCanvas);
        
        // Draw the strip with text for download
        this.drawStripTemplateForDownload(downloadCtx, downloadCanvas.width, downloadCanvas.height).then(() => {
            const dataURL = downloadCanvas.toDataURL('image/jpeg', 0.9);
            
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `photostrip-${this.currentTemplate}-${Date.now()}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('Photo strip downloaded!');
        }).catch(error => {
            console.error('Error downloading strip:', error);
            this.showNotification('Error downloading strip', 'error');
        });
    }

    closeModal() {
        document.getElementById('photoModal').classList.remove('active');
        this.currentEditingPhoto = null;
        this.originalEditImage = null;
    }

    savePhotos() {
        try {
            console.log('Saving', this.photos.length, 'photos to localStorage');
            localStorage.setItem('photoboothPhotos', JSON.stringify(this.photos));
            console.log('Photos saved successfully');
        } catch (error) {
            console.error('Error saving photos:', error);
            if (error.name === 'QuotaExceededError') {
                this.showNotification('Storage quota exceeded. Please delete some photos.', 'error');
            }
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        if (type === 'error') {
            notification.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
        } else if (type === 'info') {
            notification.style.background = 'linear-gradient(45deg, #3498db, #2980b9)';
        } else {
            notification.style.background = 'linear-gradient(45deg, #27ae60, #2ecc71)';
        }
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    createDraggableTextElements() {
        const container = document.querySelector('.canvas-container');
        const canvas = document.getElementById('stripCanvas');
        
        // Clear existing draggable elements
        this.clearDraggableText();
        
        // Create title element if title exists
        if (this.stripSettings.customTitle) {
            this.createDraggableElement(container, canvas, 'title', this.stripSettings.customTitle);
        }
        
        // Create elements for each text box
        this.stripSettings.textBoxes.forEach(textBox => {
            if (textBox.text) {
                this.createDraggableElement(container, canvas, textBox.id, textBox.text);
            }
        });
        
        // Create date element if enabled
        if (this.stripSettings.showDate) {
            const dateText = new Date().toLocaleDateString();
            this.createDraggableElement(container, canvas, 'date', dateText);
        }
        
        // Create sticker elements
        this.createDraggableStickers();
    }

    createDraggableElement(container, canvas, type, text) {
        const element = document.createElement('div');
        element.className = 'draggable-text';
        element.textContent = text;
        element.dataset.type = type;
        
        // Add delete button (except for date)
        if (type !== 'date') {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTextElement(type);
            });
            element.appendChild(deleteBtn);
            
            // Add rotation handle (except for date)
            const rotateHandle = document.createElement('div');
            rotateHandle.className = 'rotate-handle';
            element.appendChild(rotateHandle);
        }
        
        // Set initial position based on current settings
        let x, y, rotation = 0;
        if (type === 'title') {
            x = (this.stripSettings.titleX / 100) * canvas.width;
            y = (this.stripSettings.titleY / 100) * canvas.height;
            rotation = this.stripSettings.titleRotation || 0;
        } else if (type === 'date') {
            x = canvas.width / 2;
            y = canvas.height - 25; // Match the canvas positioning
        } else {
            // Find the text box in the array
            const textBox = this.stripSettings.textBoxes.find(tb => tb.id === type);
            if (textBox) {
                x = (textBox.x / 100) * canvas.width;
                y = (textBox.y / 100) * canvas.height;
                rotation = textBox.rotation || 0;
            } else {
                x = canvas.width / 2;
                y = canvas.height / 2;
            }
        }
        
        // Position element accounting for text centering
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        element.style.color = this.stripSettings.textColor;
        element.style.fontSize = type === 'title' ? '24px' : '16px';
        element.style.fontWeight = type === 'title' || type === 'date' ? 'bold' : 'normal';
        element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`; // Center and rotate the element
        
        // Special styling for date
        if (type === 'date') {
            element.style.background = 'rgba(255, 255, 255, 0.95)';
            element.style.border = '1px solid rgba(0, 0, 0, 0.2)';
            element.style.borderRadius = '3px';
            element.style.padding = '4px 8px';
            element.style.fontSize = '14px';
            element.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        }
        
        // Add drag functionality (date is not draggable, just visible)
        if (type !== 'date') {
            this.makeDraggable(element, canvas);
            // Add rotation functionality if rotate handle exists
            const rotateHandle = element.querySelector('.rotate-handle');
            if (rotateHandle) {
                this.makeTextRotatable(element, rotateHandle, type);
            }
        } else {
            element.style.cursor = 'default';
        }
        
        container.appendChild(element);
    }

    deleteTextElement(type) {
        if (type === 'title') {
            // Clear the title
            this.stripSettings.customTitle = '';
            document.getElementById('stripTitle').value = '';
        } else {
            // Remove text box
            this.removeTextBox(type);
            return; // removeTextBox handles the UI updates
        }
        
        // Remove draggable element
        const draggableElement = document.querySelector(`.draggable-text[data-type="${type}"]`);
        if (draggableElement) {
            draggableElement.remove();
        }
        
        this.updateStripPreview();
    }

    makeDraggable(element, canvas) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            element.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(element.style.left);
            initialY = parseInt(element.style.top);
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // Keep within canvas bounds (accounting for transform centering)
            const elementWidth = element.offsetWidth / 2;
            const elementHeight = element.offsetHeight / 2;
            newX = Math.max(elementWidth, Math.min(newX, canvas.width - elementWidth));
            newY = Math.max(elementHeight, Math.min(newY, canvas.height - elementHeight));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            element.classList.remove('dragging');
            
            // Update strip settings with new position
            const type = element.dataset.type;
            const x = parseInt(element.style.left);
            const y = parseInt(element.style.top);
            
            if (type === 'title') {
                this.stripSettings.titleX = (x / canvas.width) * 100;
                this.stripSettings.titleY = (y / canvas.height) * 100;
            } else {
                // Update text box position
                const textBox = this.stripSettings.textBoxes.find(tb => tb.id === type);
                if (textBox) {
                    textBox.x = (x / canvas.width) * 100;
                    textBox.y = (y / canvas.height) * 100;
                }
            }
            
            // Redraw the strip with new text positions
            this.redrawStripOnly();
        });
    }

    async redrawStripOnly() {
        // Redraw just the canvas without recreating draggable elements
        const canvas = document.getElementById('stripCanvas');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = this.stripSettings.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the strip
        await this.drawStripTemplate(ctx, canvas.width, canvas.height);
    }

    updateDraggableText() {
        // Update existing draggable text elements when text content changes
        const titleElement = document.querySelector('.draggable-text[data-type="title"]');
        
        if (titleElement) {
            if (this.stripSettings.customTitle) {
                titleElement.textContent = this.stripSettings.customTitle;
                titleElement.style.display = 'block';
            } else {
                titleElement.style.display = 'none';
            }
        }
        
        // Update text box elements
        this.stripSettings.textBoxes.forEach(textBox => {
            const textElement = document.querySelector(`.draggable-text[data-type="${textBox.id}"]`);
            if (textElement) {
                if (textBox.text) {
                    textElement.textContent = textBox.text;
                    textElement.style.display = 'block';
                } else {
                    textElement.style.display = 'none';
                }
            }
        });
        
        // Update date element
        const dateElement = document.querySelector('.draggable-text[data-type="date"]');
        if (this.stripSettings.showDate) {
            if (dateElement) {
                dateElement.textContent = new Date().toLocaleDateString();
                dateElement.style.display = 'block';
            } else {
                // Create date element if it doesn't exist
                const container = document.querySelector('.canvas-container');
                const canvas = document.getElementById('stripCanvas');
                if (container && canvas) {
                    this.createDraggableElement(container, canvas, 'date', new Date().toLocaleDateString());
                }
            }
        } else {
            if (dateElement) {
                dateElement.style.display = 'none';
            }
        }
        
        // If elements don't exist, recreate them
        if (this.selectedForStrip.length === 3) {
            this.createDraggableTextElements();
        }
    }

    updateDraggableTextColors() {
        // Update colors of existing draggable text elements
        document.querySelectorAll('.draggable-text').forEach(element => {
            element.style.color = this.stripSettings.textColor;
        });
    }

    clearDraggableText() {
        // Remove all draggable text elements
        document.querySelectorAll('.draggable-text').forEach(element => {
            element.remove();
        });
        
        // Remove all draggable sticker elements
        document.querySelectorAll('.draggable-sticker').forEach(element => {
            element.remove();
        });
    }

    addSticker(emoji) {
        const stickerId = `sticker_${this.stickerCounter++}`;
        const sticker = {
            id: stickerId,
            emoji: emoji,
            x: 50, // Center position as percentage
            y: 50,
            size: 30, // Font size
            rotation: 0 // Rotation angle in degrees
        };
        
        this.stripSettings.stickers.push(sticker);
        this.updateStripPreview();
        this.createDraggableStickers();
        this.showNotification(`${emoji} sticker added!`);
    }

    removeSticker(stickerId) {
        // Remove from settings
        this.stripSettings.stickers = this.stripSettings.stickers.filter(s => s.id !== stickerId);
        
        // Remove draggable element
        const stickerElement = document.querySelector(`.draggable-sticker[data-sticker-id="${stickerId}"]`);
        if (stickerElement) {
            stickerElement.remove();
        }
        
        this.updateStripPreview();
    }

    createDraggableStickers() {
        const container = document.querySelector('.canvas-container');
        const canvas = document.getElementById('stripCanvas');
        
        // Remove existing sticker elements
        document.querySelectorAll('.draggable-sticker').forEach(el => el.remove());
        
        // Create sticker elements
        this.stripSettings.stickers.forEach(sticker => {
            this.createDraggableStickerElement(container, canvas, sticker);
        });
    }

    createDraggableStickerElement(container, canvas, sticker) {
        const element = document.createElement('div');
        element.className = 'draggable-sticker';
        element.textContent = sticker.emoji;
        element.dataset.stickerId = sticker.id;
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSticker(sticker.id);
        });
        element.appendChild(deleteBtn);
        
        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        element.appendChild(resizeHandle);
        
        // Add rotation handle
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        element.appendChild(rotateHandle);
        
        // Set position, size, and rotation
        const x = (sticker.x / 100) * canvas.width;
        const y = (sticker.y / 100) * canvas.height;
        
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        element.style.fontSize = sticker.size + 'px';
        element.style.transform = `translate(-50%, -50%) rotate(${sticker.rotation}deg)`;
        
        // Add drag, resize, and rotate functionality
        this.makeStickerDraggable(element, canvas, sticker);
        this.makeStickerResizable(element, resizeHandle, sticker);
        this.makeStickerRotatable(element, rotateHandle, sticker);
        
        container.appendChild(element);
    }

    makeStickerDraggable(element, canvas, sticker) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
            
            isDragging = true;
            element.classList.add('dragging');
            
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(element.style.left);
            initialY = parseInt(element.style.top);
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newX = initialX + deltaX;
            let newY = initialY + deltaY;
            
            // Keep within canvas bounds (accounting for transform centering)
            const elementWidth = element.offsetWidth / 2;
            const elementHeight = element.offsetHeight / 2;
            newX = Math.max(elementWidth, Math.min(newX, canvas.width - elementWidth));
            newY = Math.max(elementHeight, Math.min(newY, canvas.height - elementHeight));
            
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            
            isDragging = false;
            element.classList.remove('dragging');
            
            // Update sticker position
            const x = parseInt(element.style.left);
            const y = parseInt(element.style.top);
            
            sticker.x = (x / canvas.width) * 100;
            sticker.y = (y / canvas.height) * 100;
            
            this.redrawStripOnly();
        });
    }

    makeStickerRotatable(element, rotateHandle, sticker) {
        let isRotating = false;
        let centerX, centerY, startAngle, currentRotation;

        rotateHandle.addEventListener('mousedown', (e) => {
            isRotating = true;
            
            // Get current rotation from sticker
            currentRotation = sticker.rotation || 0;
            
            // Get element center
            const rect = element.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            
            // Calculate initial angle
            startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isRotating) return;
            
            // Calculate current angle
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            let rotation = currentRotation + (currentAngle - startAngle);
            
            // Normalize rotation
            rotation = ((rotation % 360) + 360) % 360;
            
            element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
            sticker.rotation = rotation;
        });

        document.addEventListener('mouseup', () => {
            if (!isRotating) return;
            
            isRotating = false;
            this.redrawStripOnly();
        });
    }

    makeStickerResizable(element, resizeHandle, sticker) {
        let isResizing = false;
        let startX, startY, startSize;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startSize = parseInt(element.style.fontSize);
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            // Calculate distance moved
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Determine if we're making it bigger or smaller
            const direction = (deltaX + deltaY) > 0 ? 1 : -1;
            let newSize = startSize + (distance * direction * 0.5);
            
            // Limit size between 15px and 100px
            newSize = Math.max(15, Math.min(newSize, 100));
            
            element.style.fontSize = newSize + 'px';
            sticker.size = newSize;
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;
            
            isResizing = false;
            this.redrawStripOnly();
        });
    }

    makeTextRotatable(element, rotateHandle, type) {
        let isRotating = false;
        let centerX, centerY, startAngle, currentRotation;

        rotateHandle.addEventListener('mousedown', (e) => {
            isRotating = true;
            
            // Get current rotation
            if (type === 'title') {
                currentRotation = this.stripSettings.titleRotation || 0;
            } else {
                const textBox = this.stripSettings.textBoxes.find(tb => tb.id === type);
                currentRotation = textBox ? textBox.rotation || 0 : 0;
            }
            
            // Get element center
            const rect = element.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            
            // Calculate initial angle
            startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isRotating) return;
            
            // Calculate current angle
            const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
            let rotation = currentRotation + (currentAngle - startAngle);
            
            // Normalize rotation
            rotation = ((rotation % 360) + 360) % 360;
            
            element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
            
            // Update settings
            if (type === 'title') {
                this.stripSettings.titleRotation = rotation;
            } else {
                const textBox = this.stripSettings.textBoxes.find(tb => tb.id === type);
                if (textBox) {
                    textBox.rotation = rotation;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            if (!isRotating) return;
            
            isRotating = false;
            this.redrawStripOnly();
        });
    }
}

// Initialize the photobooth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photobooth = new PhotoBooth();
});

// Add global functions for HTML onclick events
window.editPhoto = (photoId) => photobooth.editPhoto(photoId);
window.downloadPhoto = (photoId) => photobooth.downloadPhoto(photoId);
window.deletePhoto = (photoId) => photobooth.deletePhoto(photoId); 