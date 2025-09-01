class TicketSystem {
    constructor() {
        this.apiBaseUrl = '';
        this.apiVersion = 'v1';
        this.authToken = '';
        this.apiKey = '';
        this.cognitoRegion = 'us-east-2';
        this.cognitoClientId = '';
        this.cognitoUsername = '';
        this.currentTicketId = null;
        this.tickets = [];
        
        this.initializeApp();
    }

    initializeApp() {
        this.loadConfiguration();
        this.setupEventListeners();
        this.showTicketsList();
        
        if (this.apiBaseUrl) {
            this.testConnection();
        }
    }

    loadConfiguration() {
        const savedUrl = localStorage.getItem('apiBaseUrl');
        const savedToken = localStorage.getItem('authToken');
        const savedApiKey = localStorage.getItem('apiKey');
        const savedCognitoRegion = localStorage.getItem('cognitoRegion');
        const savedCognitoClientId = localStorage.getItem('cognitoClientId');
        const savedCognitoUsername = localStorage.getItem('cognitoUsername');
        
        if (savedUrl) {
            this.apiBaseUrl = savedUrl;
            document.getElementById('apiBaseUrl').value = savedUrl;
        }
        
        if (savedToken) {
            this.authToken = savedToken;
            document.getElementById('jwtToken').value = savedToken;
        }
        
        if (savedApiKey) {
            this.apiKey = savedApiKey;
            document.getElementById('apiKey').value = savedApiKey;
        }

        if (savedCognitoRegion) {
            this.cognitoRegion = savedCognitoRegion;
            const el = document.getElementById('cognitoRegion');
            if (el) el.value = savedCognitoRegion;
        }

        if (savedCognitoClientId) {
            this.cognitoClientId = savedCognitoClientId;
            const el = document.getElementById('cognitoClientId');
            if (el) el.value = savedCognitoClientId;
        }

        if (savedCognitoUsername) {
            this.cognitoUsername = savedCognitoUsername;
            const el = document.getElementById('cognitoUsername');
            if (el) el.value = savedCognitoUsername;
        }
    }

    saveConfiguration() {
        localStorage.setItem('apiBaseUrl', this.apiBaseUrl);
        localStorage.setItem('authToken', this.authToken);
        localStorage.setItem('apiKey', this.apiKey);
        localStorage.setItem('cognitoRegion', this.cognitoRegion);
        localStorage.setItem('cognitoClientId', this.cognitoClientId);
        localStorage.setItem('cognitoUsername', this.cognitoUsername);
    }

    setupEventListeners() {
        document.getElementById('apiBaseUrl').addEventListener('change', (e) => {
            this.apiBaseUrl = e.target.value;
            this.saveConfiguration();
        });

        document.getElementById('createTicketForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTicket();
        });

        document.getElementById('editTicketForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTicket();
        });
    }


    setAuthToken() {
        const token = document.getElementById('jwtToken').value.trim();
        if (token) {
            this.authToken = token;
            this.saveConfiguration();
            this.showToast('Token de autenticación configurado', 'success');
        } else {
            this.showToast('Por favor ingresa un token válido', 'error');
        }
    }

    setApiKey() {
        const apiKey = document.getElementById('apiKey').value.trim();
        if (apiKey) {
            this.apiKey = apiKey;
            this.saveConfiguration();
            this.showToast('API Key configurada', 'success');
        } else {
            this.showToast('Por favor ingresa una API key válida', 'error');
        }
    }

    async loginWithCognito() {
        const regionInput = document.getElementById('cognitoRegion');
        const clientIdInput = document.getElementById('cognitoClientId');
        const usernameInput = document.getElementById('cognitoUsername');
        const passwordInput = document.getElementById('cognitoPassword');
        const statusEl = document.getElementById('cognitoLoginStatus');
        const loginBtn = document.getElementById('cognitoLoginBtn');

        const region = (regionInput?.value || '').trim() || 'us-east-2';
        const clientId = (clientIdInput?.value || '').trim();
        const username = (usernameInput?.value || '').trim();
        const password = (passwordInput?.value || '').trim();

        if (!clientId || !username || !password) {
            this.showToast('Completa Client ID, Usuario y Contraseña', 'error');
            return;
        }

        const url = `https://cognito-idp.${region}.amazonaws.com/`;

        const headers = {
            'Content-Type': 'application/x-amz-json-1.1',
            'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
        };

        const body = {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: clientId,
            AuthParameters: {
                USERNAME: username,
                PASSWORD: password
            }
        };

        try {
            if (statusEl) statusEl.textContent = 'Iniciando sesión...';
            if (loginBtn) loginBtn.disabled = true;

            const response = await axios.post(url, body, { headers });
            const result = response?.data?.AuthenticationResult;
            if (!result) {
                throw new Error('Autenticación requiere desafío adicional no soportado en esta demo');
            }

            const jwt = result.IdToken || result.AccessToken;
            if (!jwt) {
                throw new Error('No se recibió un token válido');
            }

            this.authToken = jwt;
            const jwtInput = document.getElementById('jwtToken');
            if (jwtInput) jwtInput.value = jwt;

            // Persist Cognito settings (no password)
            this.cognitoRegion = region;
            this.cognitoClientId = clientId;
            this.cognitoUsername = username;
            this.saveConfiguration();

            if (statusEl) statusEl.textContent = 'Autenticado. Token JWT aplicado.';
            this.showToast('Inicio de sesión exitoso. Token actualizado.', 'success');
        } catch (error) {
            const message = error?.response?.data?.message || error.message || 'Error de autenticación';
            if (statusEl) statusEl.textContent = `Error: ${message}`;
            this.showToast(`Error de login: ${message}`, 'error');
        } finally {
            if (loginBtn) loginBtn.disabled = false;
        }
    }

    async testConnection() {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Probando conexión...';
        statusElement.className = 'connection-pending';

        try {
            const response = await this.makeRequest('GET', '/tickets');
            statusElement.innerHTML = '<i class="bi bi-check-circle me-1"></i>Conexión exitosa';
            statusElement.className = 'connection-success';
            this.showToast('Conexión con la API establecida correctamente', 'success');
        } catch (error) {
            statusElement.innerHTML = '<i class="bi bi-x-circle me-1"></i>Error de conexión';
            statusElement.className = 'connection-error';
            this.showToast('Error al conectar con la API: ' + error.message, 'error');
        }
    }


    async makeRequest(method, endpoint, data = null) {
        if (!this.apiBaseUrl) {
            throw new Error('URL base de la API no configurada');
        }

        const url = `${this.apiBaseUrl}/${this.apiVersion}${endpoint}`;
        const config = {
            method,
            url,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        if (this.apiKey) {
            config.headers['x-api-key'] = this.apiKey;
        }

        if (data) {
            config.data = data;
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`Error ${error.response.status}: ${error.response.data?.message || 'Error del servidor'}`);
            } else if (error.request) {
                throw new Error('No se pudo conectar con el servidor');
            } else {
                throw new Error('Error en la solicitud: ' + error.message);
            }
        }
    }


    showView(viewId) {
        document.querySelectorAll('.view').forEach(view => {
            view.style.display = 'none';
        });
        
        const view = document.getElementById(viewId);
        if (view) {
            view.style.display = 'block';
            view.classList.add('fade-in');
        }
    }

    showTicketsList() {
        this.showView('ticketsListView');
        this.loadTickets();
    }

    showCreateTicket() {
        this.showView('createTicketView');
        this.clearCreateForm();
    }

    showTicketDetails(ticketId = null) {
        if (ticketId) {
            this.currentTicketId = ticketId;
        }
        this.showView('ticketDetailsView');
        this.loadTicketDetails();
    }

    showEditTicket() {
        this.showView('editTicketView');
        this.loadTicketForEdit();
    }


    async loadTickets() {
        const loadingElement = document.getElementById('ticketsLoading');
        const listElement = document.getElementById('ticketsList');
        
        loadingElement.style.display = 'block';
        listElement.innerHTML = '';

        try {
            const tickets = await this.makeRequest('GET', '/tickets');
            this.tickets = tickets;
            this.renderTicketsList(tickets);
            loadingElement.style.display = 'none';
        } catch (error) {
            loadingElement.style.display = 'none';
            listElement.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger" role="alert">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error al cargar tickets: ${error.message}
                    </div>
                </div>
            `;
        }
    }

    renderTicketsList(tickets) {
        const listElement = document.getElementById('ticketsList');
        
        if (!tickets || tickets.length === 0) {
            listElement.innerHTML = `
                <div class="col-12">
                    <div class="text-center py-5">
                        <i class="bi bi-inbox display-1 text-muted"></i>
                        <h4 class="mt-3 text-muted">No hay tickets</h4>
                        <p class="text-muted">Crea tu primer ticket para comenzar</p>
                        <button class="btn btn-primary" onclick="ticketSystem.showCreateTicket()">
                            <i class="bi bi-plus-circle me-1"></i>Crear Ticket
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        const ticketsHtml = tickets.map(ticket => this.createTicketCard(ticket)).join('');
        listElement.innerHTML = ticketsHtml;
    }

    createTicketCard(ticket) {
        const priorityClass = `priority-${ticket.priority}`;
        const statusClass = `status-${ticket.status}`;
        const typeClass = `type-${ticket.type}`;
        
        const createdAt = new Date(ticket.createdAt).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card ticket-card ${priorityClass}" onclick="ticketSystem.showTicketDetails('${ticket.id}')">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h6 class="card-title text-truncate" style="max-width: 200px;">${this.escapeHtml(ticket.title)}</h6>
                            <span class="priority-badge ${priorityClass}">${this.getPriorityLabel(ticket.priority)}</span>
                        </div>
                        <p class="card-text text-muted text-truncate-2" style="font-size: 0.875rem;">
                            ${this.escapeHtml(ticket.description)}
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="d-flex gap-1">
                                <span class="status-badge ${statusClass}">${this.getStatusLabel(ticket.status)}</span>
                                <span class="type-badge ${typeClass}">${this.getTypeLabel(ticket.type)}</span>
                            </div>
                            <small class="text-muted">${createdAt}</small>
                        </div>
                        <div class="mt-2">
                            <small class="text-muted">
                                <i class="bi bi-person me-1"></i>Reportero: ${ticket.reporterId.substring(0, 8)}...
                            </small>
                            ${ticket.assignedToId ? `
                                <br><small class="text-muted">
                                    <i class="bi bi-person-check me-1"></i>Asignado: ${ticket.assignedToId.substring(0, 8)}...
                                </small>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async loadTicketDetails() {
        const loadingElement = document.getElementById('ticketDetailsLoading');
        const contentElement = document.getElementById('ticketDetailsContent');
        
        loadingElement.style.display = 'block';
        contentElement.style.display = 'none';

        try {
            const ticket = await this.makeRequest('GET', `/tickets/${this.currentTicketId}`);
            this.renderTicketDetails(ticket);
            loadingElement.style.display = 'none';
            contentElement.style.display = 'block';
        } catch (error) {
            loadingElement.style.display = 'none';
            contentElement.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Error al cargar el ticket: ${error.message}
                </div>
            `;
            contentElement.style.display = 'block';
        }
    }

    renderTicketDetails(ticket) {
        const contentElement = document.getElementById('ticketDetailsContent');
        
        const createdAt = new Date(ticket.createdAt).toLocaleString('es-ES');
        const updatedAt = new Date(ticket.updatedAt).toLocaleString('es-ES');
        
        const priorityClass = `priority-${ticket.priority}`;
        const statusClass = `status-${ticket.status}`;
        const typeClass = `type-${ticket.type}`;

        contentElement.innerHTML = `
            <div class="row">
                <div class="col-md-8">
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">ID del Ticket</div>
                        <div class="ticket-detail-value font-monospace">${ticket.id}</div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Título</div>
                        <div class="ticket-detail-value">${this.escapeHtml(ticket.title)}</div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Descripción</div>
                        <div class="ticket-detail-value">${this.escapeHtml(ticket.description)}</div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Reportero</div>
                        <div class="ticket-detail-value font-monospace">${ticket.reporterId}</div>
                    </div>
                    ${ticket.assignedToId ? `
                        <div class="ticket-detail-item">
                            <div class="ticket-detail-label">Asignado a</div>
                            <div class="ticket-detail-value font-monospace">${ticket.assignedToId}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="col-md-4">
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Estado</div>
                        <div class="ticket-detail-value">
                            <span class="status-badge ${statusClass}">${this.getStatusLabel(ticket.status)}</span>
                        </div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Prioridad</div>
                        <div class="ticket-detail-value">
                            <span class="priority-badge ${priorityClass}">${this.getPriorityLabel(ticket.priority)}</span>
                        </div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Tipo</div>
                        <div class="ticket-detail-value">
                            <span class="type-badge ${typeClass}">${this.getTypeLabel(ticket.type)}</span>
                        </div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Creado</div>
                        <div class="ticket-detail-value">${createdAt}</div>
                    </div>
                    <div class="ticket-detail-item">
                        <div class="ticket-detail-label">Actualizado</div>
                        <div class="ticket-detail-value">${updatedAt}</div>
                    </div>
                </div>
            </div>
        `;
    }

    async createTicket() {
        const formData = {
            title: document.getElementById('ticketTitle').value.trim(),
            description: document.getElementById('ticketDescription').value.trim(),
            reporterId: document.getElementById('ticketReporterId').value.trim(),
            status: document.getElementById('ticketStatus').value,
            priority: document.getElementById('ticketPriority').value,
            type: document.getElementById('ticketType').value
        };

        const assignedToId = document.getElementById('ticketAssignedToId').value.trim();
        if (assignedToId) {
            formData.assignedToId = assignedToId;
        }

        try {
            const newTicket = await this.makeRequest('POST', '/tickets', formData);
            this.showToast('Ticket creado exitosamente', 'success');
            this.showTicketsList();
        } catch (error) {
            this.showToast('Error al crear ticket: ' + error.message, 'error');
        }
    }

    async updateTicket() {
        const formData = {
            title: document.getElementById('editTicketTitle').value.trim(),
            description: document.getElementById('editTicketDescription').value.trim(),
            reporterId: document.getElementById('editTicketReporterId').value.trim(),
            status: document.getElementById('editTicketStatus').value,
            priority: document.getElementById('editTicketPriority').value,
            type: document.getElementById('editTicketType').value
        };

        const assignedToId = document.getElementById('editTicketAssignedToId').value.trim();
        if (assignedToId) {
            formData.assignedToId = assignedToId;
        } else {
            formData.assignedToId = null;
        }

        try {
            await this.makeRequest('PUT', `/tickets/${this.currentTicketId}`, formData);
            this.showToast('Ticket actualizado exitosamente', 'success');
            this.showTicketDetails();
        } catch (error) {
            this.showToast('Error al actualizar ticket: ' + error.message, 'error');
        }
    }

    async deleteTicket() {
        if (!confirm('¿Estás seguro de que quieres eliminar este ticket? Esta acción no se puede deshacer.')) {
            return;
        }

        try {
            await this.makeRequest('DELETE', `/tickets/${this.currentTicketId}`);
            this.showToast('Ticket eliminado exitosamente', 'success');
            this.showTicketsList();
        } catch (error) {
            this.showToast('Error al eliminar ticket: ' + error.message, 'error');
        }
    }

    loadTicketForEdit() {
        const ticket = this.tickets.find(t => t.id === this.currentTicketId);
        if (!ticket) {
            this.showToast('No se pudo cargar el ticket para editar', 'error');
            return;
        }

        document.getElementById('editTicketTitle').value = ticket.title;
        document.getElementById('editTicketDescription').value = ticket.description;
        document.getElementById('editTicketReporterId').value = ticket.reporterId;
        document.getElementById('editTicketStatus').value = ticket.status;
        document.getElementById('editTicketPriority').value = ticket.priority;
        document.getElementById('editTicketType').value = ticket.type;
        document.getElementById('editTicketAssignedToId').value = ticket.assignedToId || '';
    }

    clearCreateForm() {
        document.getElementById('createTicketForm').reset();
        document.getElementById('ticketStatus').value = 'OPEN';
        document.getElementById('ticketPriority').value = 'MEDIUM';
        document.getElementById('ticketType').value = 'INCIDENT';
    }


    refreshTickets() {
        this.loadTickets();
    }

    editTicket() {
        this.showEditTicket();
    }

    deleteTicket() {
        this.deleteTicket();
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastBody = document.getElementById('toastBody');
        const toastHeader = toast.querySelector('.toast-header i');
        
        toastBody.textContent = message;
        
        toastHeader.className = `bi me-2`;
        if (type === 'success') {
            toastHeader.classList.add('bi-check-circle-fill', 'text-success');
        } else if (type === 'error') {
            toastHeader.classList.add('bi-exclamation-triangle-fill', 'text-danger');
        } else if (type === 'warning') {
            toastHeader.classList.add('bi-exclamation-triangle-fill', 'text-warning');
        } else {
            toastHeader.classList.add('bi-info-circle-fill', 'text-primary');
        }
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getStatusLabel(status) {
        const labels = {
            'NEW': 'Nuevo',
            'OPEN': 'Abierto',
            'IN_PROGRESS': 'En Progreso',
            'RESOLVED': 'Resuelto',
            'CLOSED': 'Cerrado'
        };
        return labels[status] || status;
    }

    getPriorityLabel(priority) {
        const labels = {
            'LOW': 'Baja',
            'MEDIUM': 'Media',
            'HIGH': 'Alta',
            'CRITICAL': 'Crítica'
        };
        return labels[priority] || priority;
    }

    getTypeLabel(type) {
        const labels = {
            'INCIDENT': 'Incidente',
            'SERVICE_REQUEST': 'Solicitud',
            'QUESTION': 'Pregunta'
        };
        return labels[type] || type;
    }
}
function showTicketsList() {
    ticketSystem.showTicketsList();
}

function showCreateTicket() {
    ticketSystem.showCreateTicket();
}

function showTicketDetails(ticketId = null) {
    ticketSystem.showTicketDetails(ticketId);
}

function editTicket() {
    ticketSystem.editTicket();
}

function deleteTicket() {
    ticketSystem.deleteTicket();
}

function refreshTickets() {
    ticketSystem.refreshTickets();
}

function setAuthToken() {
    ticketSystem.setAuthToken();
}

function setApiKey() {
    ticketSystem.setApiKey();
}

function loginWithCognito() {
    ticketSystem.loginWithCognito();
}

function showSecuritySettings() {
    const securitySection = document.querySelector('.card-header:has(.bi-shield-lock)').closest('.card');
    securitySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    securitySection.style.transition = 'box-shadow 0.3s ease';
    securitySection.style.boxShadow = '0 0 0 0.2rem rgba(13, 110, 253, 0.25)';
    setTimeout(() => {
        securitySection.style.boxShadow = '';
    }, 2000);
}

function testConnection() {
    ticketSystem.testConnection();
}

let ticketSystem;
document.addEventListener('DOMContentLoaded', function() {
    ticketSystem = new TicketSystem();
});