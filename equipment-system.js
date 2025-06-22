/**
 * Sistema de Monitoramento de Equipamentos - Pernambuco III
 * Funcionalidades JavaScript para validação e integração com Google Sheets
 */

// Configurações globais
const CONFIG = {
  // Endpoint do Google Apps Script (substitua pela URL real)
  GOOGLE_SHEETS_ENDPOINT: "https://script.google.com/macros/s/AKfycbyurx-AComFmPJVn-QomM9A04hTj4ukhf2l-Womj9RCUI4Qptp4xDX4lPW-Iyy2u6y38w/exec",
  
  // Configurações de validação
  VALIDATION: {
    MAX_OBSERVACOES_LENGTH: 100,
    REQUIRED_FIELDS: {
      OPE: ['TAG', 'STATUS'],
      'ST-BY': ['TAG', 'STATUS', 'MOTIVO'],
      MNT: ['TAG', 'STATUS', 'MOTIVO']
    },
    STATUS_OPTIONS: {
      OPE: 'Em Operação',
      'ST-BY': 'Stand-by',
      MNT: 'Em Manutenção'
    },
    MOTIVO_OPTIONS: {
      'ST-BY': [
        'Conveniência operacional',
        'Conveniência do sistema'
      ],
      MNT: [
        'Manutenção preventiva',
        'Manutenção corretiva',
        'Manutenção preditiva'
      ]
    }
  },
  
  // Configurações de interface
  UI: {
    ANIMATION_DURATION: 300,
    AUTO_REFRESH_INTERVAL: 30000, // 30 segundos
    MESSAGE_DISPLAY_TIME: 5000 // 5 segundos
  }
};

// Estado global da aplicação
const AppState = {
  equipamentosData: [],
  equipamentoSelecionado: null,
  isLoading: false,
  lastUpdate: null
};

/**
 * Classe principal para gerenciar o sistema
 */
class EquipmentMonitoringSystem {
  constructor() {
    this.init();
  }

  /**
   * Inicialização do sistema
   */
  init() {
    this.setupEventListeners();
    this.startAutoRefresh();
    this.updateClock();
    this.loadInitialData();
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Event listeners para formulários
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    const statusForm = document.getElementById('form-status');
    if (statusForm) {
      statusForm.addEventListener('submit', (e) => this.handleStatusUpdate(e));
    }

    const csvForm = document.getElementById('csv-upload-form');
    if (csvForm) {
      csvForm.addEventListener('submit', (e) => this.handleCsvUpload(e));
    }

    // Event listeners para campos do formulário
    const dispositivoSelect = document.getElementById('dispositivo');
    if (dispositivoSelect) {
      dispositivoSelect.addEventListener('change', () => this.handleEquipmentSelection());
    }

    const statusSelect = document.getElementById('status');
    if (statusSelect) {
      statusSelect.addEventListener('change', () => this.handleStatusChange());
    }

    // Event listeners para filtros
    const filtroBusca = document.getElementById('filtro-busca');
    if (filtroBusca) {
      filtroBusca.addEventListener('input', () => this.applyFilters());
    }

    const filtroStatus = document.getElementById('filtro-status');
    if (filtroStatus) {
      filtroStatus.addEventListener('change', () => this.applyFilters());
    }

    // Event listener para contador de caracteres
    const observacoesField = document.getElementById('observacoes');
    if (observacoesField) {
      observacoesField.addEventListener('input', () => this.updateCharacterCount());
    }

    // Event listeners para botões
    document.addEventListener('click', (e) => {
      if (e.target.matches('[onclick*="carregarEquipamentos"]')) {
        e.preventDefault();
        this.loadEquipments();
      }
      
      if (e.target.matches('[onclick*="limparFiltros"]')) {
        e.preventDefault();
        this.clearFilters();
      }

      // Efeito ripple para botões Flutter
      if (e.target.classList.contains('flutter-button') || e.target.classList.contains('flutter-fab')) {
        this.addRippleEffect(e);
      }
    });
  }

  /**
   * Carregar dados iniciais
   */
  async loadInitialData() {
    const currentPage = this.getCurrentPage();
    
    switch (currentPage) {
      case 'entrada':
        await this.loadEquipments();
        this.loadRegistros();
        break;
      case 'status':
        await this.loadEquipments();
        break;
      default:
        break;
    }
  }

  /**
   * Identificar página atual
   */
  getCurrentPage() {
    const path = window.location.pathname;
    if (path.includes('entrada')) return 'entrada';
    if (path.includes('status')) return 'status';
    if (path.includes('csv_update')) return 'csv_update';
    return 'index';
  }

  /**
   * Gerenciar login
   */
  async handleLogin(event) {
    event.preventDefault();
    
    const login = document.getElementById("login").value.toLowerCase().trim();
    const senha = document.getElementById("senha").value;
    const button = event.target.querySelector('.flutter-button');
    
    this.setButtonLoading(button, true);
    
    // Simular delay de autenticação
    await this.delay(1500);
    
    if (login === "admin" && senha === "admin") {
      this.showMessage("Login realizado com sucesso!", "success");
      localStorage.setItem("acesso", "total");
      await this.delay(1000);
      window.location.href = "entrada-flutter.html";
    } else if (login === "operador" && senha === "operador") {
      this.showMessage("Login realizado com sucesso!", "success");
      localStorage.setItem("acesso", "status");
      await this.delay(1000);
      window.location.href = "status-flutter.html";
    } else {
      this.showMessage("Usuário ou senha inválidos.", "error");
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Carregar equipamentos do Google Sheets
   */
  async loadEquipments() {
    const select = document.getElementById("dispositivo");
    const fabIcon = document.getElementById("fab-icon");
    
    if (fabIcon) {
      this.animateRefreshIcon(fabIcon);
    }
    
    if (select) {
      select.innerHTML = "<option value=\"\">-- Carregando equipamentos... --</option>";
    }

    try {
      AppState.isLoading = true;
      const response = await fetch(CONFIG.GOOGLE_SHEETS_ENDPOINT);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      AppState.equipamentosData = data;
      AppState.lastUpdate = new Date();

      if (select) {
        this.populateEquipmentSelect(data);
      }
      
      // Atualizar estatísticas se estivermos na página de status
      if (this.getCurrentPage() === 'status') {
        this.updateStatistics();
        this.applyFilters();
        this.updateLastUpdateTime();
      }
      
      this.showMessage("Equipamentos carregados com sucesso!", "success");
      
    } catch (error) {
      console.error("Erro ao carregar equipamentos:", error);
      this.showMessage("Erro ao carregar a lista de equipamentos.", "error");
      
      if (select) {
        select.innerHTML = "<option value=\"\">-- Erro ao carregar --</option>";
      }
    } finally {
      AppState.isLoading = false;
    }
  }

  /**
   * Popular select de equipamentos
   */
  populateEquipmentSelect(data) {
    const select = document.getElementById("dispositivo");
    if (!select) return;

    select.innerHTML = "<option value=\"\">-- Selecione um equipamento --</option>";
    
    data.forEach(equip => {
      const option = document.createElement("option");
      option.value = equip.TAG;
      option.textContent = equip.TAG;
      select.appendChild(option);
    });
  }

  /**
   * Gerenciar seleção de equipamento
   */
  handleEquipmentSelection() {
    const select = document.getElementById("dispositivo");
    const dadosContainer = document.getElementById("dados-equipamento");
    
    if (!select || !dadosContainer) return;
    
    if (select.value) {
      AppState.equipamentoSelecionado = AppState.equipamentosData.find(e => e.TAG === select.value);
      
      if (AppState.equipamentoSelecionado) {
        this.populateEquipmentForm(AppState.equipamentoSelecionado);
        this.showElement(dadosContainer);
      }
    } else {
      this.hideElement(dadosContainer);
      AppState.equipamentoSelecionado = null;
    }
  }

  /**
   * Popular formulário com dados do equipamento
   */
  populateEquipmentForm(equipment) {
    const fields = {
      'status': equipment.STATUS || '',
      'pts': equipment.PTS || '',
      'os': equipment.OS || '',
      'retorno': equipment.RETORNO ? new Date(equipment.RETORNO).toISOString().slice(0,16) : '',
      'cadeado': equipment.CADEADO || '',
      'observacoes': equipment.OBSERVACOES || '',
      'modificado_por': equipment.MODIFICADO_POR || 'admin'
    };

    Object.entries(fields).forEach(([fieldId, value]) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = value;
      }
    });

    // Atualizar contador de caracteres
    this.updateCharacterCount();
    
    // Atualizar campos condicionais
    this.handleStatusChange();
  }

  /**
   * Gerenciar mudança de status
   */
  handleStatusChange() {
    const status = document.getElementById("status")?.value;
    const motivoContainer = document.getElementById("motivo-container");
    const motivoSelect = document.getElementById("motivo");
    
    // Containers dos campos de manutenção (D, E, F, G)
    const maintenanceContainers = [
      'pts-container',
      'os-container', 
      'retorno-container',
      'cadeado-container'
    ].map(id => document.getElementById(id)).filter(Boolean);
    
    // Esconder todos os campos condicionais primeiro
    if (motivoContainer) this.hideElement(motivoContainer);
    maintenanceContainers.forEach(container => this.hideElement(container));
    
    // Limpar opções do motivo
    if (motivoSelect) {
      motivoSelect.innerHTML = '<option value="">-- Selecione o motivo --</option>';
    }
    
    // Mostrar campos baseado no status
    if (status === "ST-BY") {
      if (motivoContainer) this.showElement(motivoContainer);
      this.populateMotiveOptions('ST-BY');
      
    } else if (status === "MNT") {
      if (motivoContainer) this.showElement(motivoContainer);
      maintenanceContainers.forEach(container => this.showElement(container));
      this.populateMotiveOptions('MNT');
    }
    
    // Preencher motivo se já existir
    if (AppState.equipamentoSelecionado && AppState.equipamentoSelecionado.MOTIVO && motivoSelect) {
      motivoSelect.value = AppState.equipamentoSelecionado.MOTIVO;
    }
  }

  /**
   * Popular opções de motivo
   */
  populateMotiveOptions(status) {
    const motivoSelect = document.getElementById("motivo");
    if (!motivoSelect) return;

    const options = CONFIG.VALIDATION.MOTIVO_OPTIONS[status] || [];
    
    options.forEach(opcao => {
      const option = document.createElement("option");
      option.value = opcao;
      option.textContent = opcao;
      motivoSelect.appendChild(option);
    });
  }

  /**
   * Gerenciar atualização de status
   */
  async handleStatusUpdate(event) {
    event.preventDefault();
    
    const formData = this.getFormData();
    const validationResult = this.validateFormData(formData);
    
    if (!validationResult.isValid) {
      this.showMessage(validationResult.message, "error");
      return;
    }

    const button = event.target.querySelector("button[type=\"submit\"]");
    this.setButtonLoading(button, true);
    
    try {
      const response = await fetch(CONFIG.GOOGLE_SHEETS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "update_row",
          ...formData,
          DATA: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.showMessage("Equipamento atualizado com sucesso!", "success");
        await this.loadEquipments();
        this.loadRegistros();
        
        // Manter seleção do equipamento
        const dispositivoSelect = document.getElementById("dispositivo");
        if (dispositivoSelect) {
          dispositivoSelect.value = formData.TAG;
          this.handleEquipmentSelection();
        }
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }
      
    } catch (error) {
      console.error("Erro:", error);
      this.showMessage("Erro ao atualizar equipamento. Tente novamente.", "error");
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Obter dados do formulário
   */
  getFormData() {
    const fields = ['dispositivo', 'status', 'motivo', 'pts', 'os', 'retorno', 'cadeado', 'observacoes', 'modificado_por'];
    const data = {};
    
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        data[fieldId === 'dispositivo' ? 'TAG' : fieldId.toUpperCase()] = field.value || '';
      }
    });
    
    return data;
  }

  /**
   * Validar dados do formulário
   */
  validateFormData(data) {
    // Validar equipamento selecionado
    if (!data.TAG || !AppState.equipamentoSelecionado) {
      return { isValid: false, message: "Por favor, selecione um equipamento." };
    }
    
    // Validar status
    if (!data.STATUS) {
      return { isValid: false, message: "Por favor, selecione um status." };
    }
    
    // Validar motivo para ST-BY e MNT
    if ((data.STATUS === 'ST-BY' || data.STATUS === 'MNT') && !data.MOTIVO) {
      return { isValid: false, message: "Por favor, selecione um motivo." };
    }
    
    // Validar motivo correto para o status
    if (data.MOTIVO) {
      const validMotivos = CONFIG.VALIDATION.MOTIVO_OPTIONS[data.STATUS] || [];
      if (!validMotivos.includes(data.MOTIVO)) {
        return { isValid: false, message: "Motivo inválido para o status selecionado." };
      }
    }
    
    // Validar observações
    if (data.OBSERVACOES && data.OBSERVACOES.length > CONFIG.VALIDATION.MAX_OBSERVACOES_LENGTH) {
      return { isValid: false, message: `Observações não podem exceder ${CONFIG.VALIDATION.MAX_OBSERVACOES_LENGTH} caracteres.` };
    }
    
    return { isValid: true };
  }

  /**
   * Carregar registros de modificações
   */
  async loadRegistros() {
    try {
      const response = await fetch(CONFIG.GOOGLE_SHEETS_ENDPOINT);
      const data = await response.json();
      this.renderRegistros(data.slice(0, 10)); // Últimos 10 registros
    } catch (error) {
      console.error("Erro ao carregar registros:", error);
    }
  }

  /**
   * Renderizar registros
   */
  renderRegistros(registros) {
    const lista = document.getElementById("registro-lista");
    if (!lista) return;
    
    if (registros.length === 0) {
      lista.innerHTML = "<p class=\"flutter-text-center flutter-text-sm\" style=\"color: var(--text-tertiary);\">Nenhuma modificação registrada ainda.</p>";
      return;
    }
    
    lista.innerHTML = registros.map(registro => this.createRegistroCard(registro)).join("");
  }

  /**
   * Criar card de registro
   */
  createRegistroCard(registro) {
    const statusClass = (registro.STATUS || "").toLowerCase().replace('-', '');
    
    return `
      <div class="flutter-equipment-card" style="margin-bottom: var(--space-4);">
        <div class="flutter-equipment-header">
          <div class="flutter-equipment-name">${registro.TAG || "N/A"}</div>
          <span class="flutter-badge flutter-badge-${statusClass}">${registro.STATUS || "N/A"}</span>
        </div>
        <div class="flutter-equipment-details">
          ${registro.MOTIVO ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Motivo:</span><span class="flutter-detail-value">${registro.MOTIVO}</span></div>` : ""}
          ${registro.PTS ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">PTS:</span><span class="flutter-detail-value">${registro.PTS}</span></div>` : ""}
          ${registro.OS ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">OS:</span><span class="flutter-detail-value">${registro.OS}</span></div>` : ""}
          ${registro.OBSERVACOES ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Observações:</span><span class="flutter-detail-value">${registro.OBSERVACOES}</span></div>` : ""}
        </div>
        <div class="flutter-equipment-footer">
          <span>Por: ${registro.MODIFICADO_POR || "N/A"}</span>
          <span>${registro.DATA ? new Date(registro.DATA).toLocaleString("pt-BR") : "N/A"}</span>
        </div>
      </div>
    `;
  }

  /**
   * Aplicar filtros (página de status)
   */
  applyFilters() {
    const busca = document.getElementById("filtro-busca")?.value.toLowerCase() || '';
    const statusFiltro = document.getElementById("filtro-status")?.value || '';
    
    const equipamentosFiltrados = AppState.equipamentosData.filter(equip => {
      const matchBusca = !busca || 
        (equip.TAG && equip.TAG.toLowerCase().includes(busca)) ||
        (equip.NOME && equip.NOME.toLowerCase().includes(busca));
      
      const matchStatus = !statusFiltro || equip.STATUS === statusFiltro;
      
      return matchBusca && matchStatus;
    });
    
    this.renderEquipments(equipamentosFiltrados);
  }

  /**
   * Limpar filtros
   */
  clearFilters() {
    const filtroBusca = document.getElementById("filtro-busca");
    const filtroStatus = document.getElementById("filtro-status");
    
    if (filtroBusca) filtroBusca.value = "";
    if (filtroStatus) filtroStatus.value = "";
    
    this.applyFilters();
  }

  /**
   * Renderizar equipamentos (página de status)
   */
  renderEquipments(equipamentos) {
    const container = document.getElementById("equipamentos-container");
    const noResults = document.getElementById("no-results");
    const loading = document.getElementById("loading-container");
    
    if (loading) loading.style.display = "none";
    
    if (equipamentos.length === 0) {
      if (container) container.style.display = "none";
      if (noResults) noResults.style.display = "block";
      return;
    }
    
    if (container) container.style.display = "grid";
    if (noResults) noResults.style.display = "none";
    
    if (container) {
      container.innerHTML = equipamentos.map(equip => this.createEquipmentCard(equip)).join("");
    }
  }

  /**
   * Criar card de equipamento
   */
  createEquipmentCard(equip) {
    const statusClass = (equip.STATUS || "").toLowerCase().replace("-", "");
    const statusIcon = this.getStatusIcon(equip.STATUS);
    
    return `
      <div class="flutter-equipment-card">
        <div class="flutter-equipment-header">
          <div class="flutter-equipment-name">${equip.TAG || "N/A"}</div>
          <span class="flutter-badge flutter-badge-${statusClass}">${statusIcon} ${equip.STATUS || "N/A"}</span>
        </div>
        <div class="flutter-equipment-details">
          ${equip.MOTIVO ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Motivo:</span><span class="flutter-detail-value">${equip.MOTIVO}</span></div>` : ""}
          ${equip.PTS ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">PTS:</span><span class="flutter-detail-value">${equip.PTS}</span></div>` : ""}
          ${equip.OS ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">OS:</span><span class="flutter-detail-value">${equip.OS}</span></div>` : ""}
          ${equip.RETORNO ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Retorno:</span><span class="flutter-detail-value">${new Date(equip.RETORNO).toLocaleString("pt-BR")}</span></div>` : ""}
          ${equip.CADEADO ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Cadeado:</span><span class="flutter-detail-value">${equip.CADEADO}</span></div>` : ""}
          ${equip.OBSERVACOES ? `<div class="flutter-equipment-detail"><span class="flutter-detail-label">Observações:</span><span class="flutter-detail-value">${equip.OBSERVACOES}</span></div>` : ""}
        </div>
        <div class="flutter-equipment-footer">
          <span>${equip.MODIFICADO_POR ? `👤 ${equip.MODIFICADO_POR}` : ""}</span>
          <span>${equip.DATA ? `🕒 ${new Date(equip.DATA).toLocaleString("pt-BR")}` : ""}</span>
        </div>
      </div>
    `;
  }

  /**
   * Obter ícone do status
   */
  getStatusIcon(status) {
    const icons = {
      'OPE': '🟢',
      'ST-BY': '🟡', 
      'MNT': '🔴'
    };
    return icons[status] || '⚪';
  }

  /**
   * Atualizar estatísticas
   */
  updateStatistics() {
    const total = AppState.equipamentosData.length;
    const operacao = AppState.equipamentosData.filter(e => e.STATUS === "OPE").length;
    const standby = AppState.equipamentosData.filter(e => e.STATUS === "ST-BY").length;
    const manutencao = AppState.equipamentosData.filter(e => e.STATUS === "MNT").length;
    
    this.animateNumber("total-equipamentos", total);
    this.animateNumber("total-operacao", operacao);
    this.animateNumber("total-standby", standby);
    this.animateNumber("total-manutencao", manutencao);
  }

  /**
   * Animar números
   */
  animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    const increment = targetValue > currentValue ? 1 : -1;
    const duration = 1000;
    const steps = Math.abs(targetValue - currentValue);
    const stepDuration = steps > 0 ? duration / steps : 0;
    
    let current = currentValue;
    const timer = setInterval(() => {
      current += increment;
      element.textContent = current;
      
      if (current === targetValue) {
        clearInterval(timer);
      }
    }, stepDuration);
  }

  /**
   * Atualizar contador de caracteres
   */
  updateCharacterCount() {
    const observacoesField = document.getElementById('observacoes');
    const charCount = document.getElementById('char-count');
    
    if (observacoesField && charCount) {
      charCount.textContent = observacoesField.value.length;
    }
  }

  /**
   * Atualizar relógio
   */
  updateClock() {
    const relogio = document.getElementById("relogio");
    if (relogio) {
      const agora = new Date();
      relogio.textContent = agora.toLocaleString("pt-BR");
    }
    
    setTimeout(() => this.updateClock(), 1000);
  }

  /**
   * Atualizar tempo da última atualização
   */
  updateLastUpdateTime() {
    const element = document.getElementById("ultima-atualizacao");
    if (element && AppState.lastUpdate) {
      element.textContent = AppState.lastUpdate.toLocaleString("pt-BR");
    }
  }

  /**
   * Iniciar atualização automática
   */
  startAutoRefresh() {
    setInterval(() => {
      if (!AppState.isLoading) {
        this.loadEquipments();
        if (this.getCurrentPage() === 'entrada') {
          this.loadRegistros();
        }
      }
    }, CONFIG.UI.AUTO_REFRESH_INTERVAL);
  }

  /**
   * Mostrar mensagem
   */
  showMessage(texto, tipo) {
    const mensagem = document.getElementById("mensagem");
    if (!mensagem) return;
    
    const icon = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    mensagem.innerHTML = `<span style="margin-right: var(--space-2);">${icon}</span><div>${texto}</div>`;
    mensagem.className = `flutter-message flutter-message-${tipo}`;
    mensagem.style.display = "flex";
    
    setTimeout(() => {
      mensagem.style.display = "none";
    }, CONFIG.UI.MESSAGE_DISPLAY_TIME);
  }

  /**
   * Definir estado de loading do botão
   */
  setButtonLoading(button, isLoading) {
    if (!button) return;
    
    const buttonText = button.querySelector('#button-text, span:not(.flutter-spinner)');
    const buttonLoader = button.querySelector('#button-loader, .flutter-spinner');
    
    if (isLoading) {
      if (buttonText) buttonText.style.display = 'none';
      if (buttonLoader) buttonLoader.style.display = 'inline-block';
      button.disabled = true;
    } else {
      if (buttonText) buttonText.style.display = 'inline';
      if (buttonLoader) buttonLoader.style.display = 'none';
      button.disabled = false;
    }
  }

  /**
   * Animar ícone de refresh
   */
  animateRefreshIcon(icon) {
    icon.style.transform = "rotate(360deg)";
    setTimeout(() => {
      icon.style.transform = "rotate(0deg)";
    }, 500);
  }

  /**
   * Mostrar elemento com animação
   */
  showElement(element) {
    if (!element) return;
    
    element.classList.remove("flutter-field-hidden");
    element.classList.add("flutter-field-visible");
  }

  /**
   * Esconder elemento com animação
   */
  hideElement(element) {
    if (!element) return;
    
    element.classList.remove("flutter-field-visible");
    element.classList.add("flutter-field-hidden");
  }

  /**
   * Adicionar efeito ripple
   */
  addRippleEffect(event) {
    const button = event.target.closest('.flutter-button, .flutter-fab');
    if (!button) return;
    
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  /**
   * Utilitário para delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gerenciar upload de CSV
   */
  async handleCsvUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById("csvFile");
    const file = fileInput?.files[0];
    
    if (!file) {
      this.showMessage("Por favor, selecione um arquivo CSV para upload.", "error");
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showMessage("Por favor, selecione apenas arquivos .csv", "error");
      return;
    }

    const button = event.target.querySelector("button[type=\"submit\"]");
    this.setButtonLoading(button, true);

    try {
      const csvText = await this.readFileAsText(file);
      const data = this.parseCsvData(csvText);
      
      const validationErrors = this.validateCsvData(data);
      if (validationErrors.length > 0) {
        throw new Error(`Erros de validação encontrados:\n${validationErrors.join('\n')}`);
      }

      const response = await fetch(CONFIG.GOOGLE_SHEETS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          type: "full_replace",
          data: data 
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        this.showMessage(`✅ Planilha substituída com sucesso! ${data.length} registros foram carregados.`, "success");
        fileInput.value = "";
        
        // Remover preview
        const preview = document.getElementById('file-preview');
        if (preview) {
          preview.remove();
        }
      } else {
        throw new Error(result.error || "Erro desconhecido ao processar o CSV");
      }
    } catch (error) {
      console.error("Erro ao processar CSV:", error);
      this.showMessage(`❌ Erro ao processar CSV: ${error.message}`, "error");
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Ler arquivo como texto
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo CSV"));
      reader.readAsText(file);
    });
  }

  /**
   * Parsear dados CSV
   */
  parseCsvData(csvText) {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== "");
    
    if (lines.length < 2) {
      throw new Error("O arquivo CSV deve conter pelo menos um cabeçalho e uma linha de dados.");
    }

    const headers = lines[0].split(",").map(h => h.trim());
    const expectedHeaders = ["TAG", "STATUS", "MOTIVO", "PTS", "OS", "RETORNO", "CADEADO", "OBSERVACOES", "MODIFICADO_POR", "DATA"];
    
    if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
      throw new Error(`Cabeçalhos incorretos. Esperado: ${expectedHeaders.join(",")}. Encontrado: ${headers.join(",")}`);
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : "";
      });
      data.push(row);
    }

    return data;
  }

  /**
   * Validar dados CSV
   */
  validateCsvData(data) {
    const errors = [];
    
    data.forEach((row, index) => {
      const lineNum = index + 2;
      
      // Validar TAG obrigatória
      if (!row.TAG || row.TAG.trim() === '') {
        errors.push(`Linha ${lineNum}: TAG é obrigatória`);
      }
      
      // Validar STATUS
      if (!['OPE', 'ST-BY', 'MNT'].includes(row.STATUS)) {
        errors.push(`Linha ${lineNum}: STATUS deve ser OPE, ST-BY ou MNT`);
      }
      
      // Validar MOTIVO baseado no STATUS
      if (row.STATUS === 'ST-BY') {
        const validStandbyMotivos = CONFIG.VALIDATION.MOTIVO_OPTIONS['ST-BY'];
        if (row.MOTIVO && !validStandbyMotivos.includes(row.MOTIVO)) {
          errors.push(`Linha ${lineNum}: MOTIVO para ST-BY deve ser: ${validStandbyMotivos.join(' ou ')}`);
        }
      } else if (row.STATUS === 'MNT') {
        const validMntMotivos = CONFIG.VALIDATION.MOTIVO_OPTIONS['MNT'];
        if (row.MOTIVO && !validMntMotivos.includes(row.MOTIVO)) {
          errors.push(`Linha ${lineNum}: MOTIVO para MNT deve ser: ${validMntMotivos.join(', ')}`);
        }
      }
      
      // Validar formato de data se presente
      if (row.DATA && row.DATA.trim() !== '') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
        if (!dateRegex.test(row.DATA)) {
          errors.push(`Linha ${lineNum}: DATA deve estar no formato YYYY-MM-DDTHH:MM:SS`);
        }
      }
      
      // Validar formato de retorno se presente
      if (row.RETORNO && row.RETORNO.trim() !== '') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
        if (!dateRegex.test(row.RETORNO)) {
          errors.push(`Linha ${lineNum}: RETORNO deve estar no formato YYYY-MM-DDTHH:MM`);
        }
      }
    });
    
    return errors;
  }
}

// Inicializar sistema quando DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  window.equipmentSystem = new EquipmentMonitoringSystem();
});

// Exportar para uso global
window.EquipmentMonitoringSystem = EquipmentMonitoringSystem;

