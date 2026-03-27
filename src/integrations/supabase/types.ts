export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_type_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          section: string
          user_type: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          section: string
          user_type: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          section?: string
          user_type?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      alm_fornecedores: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      alm_locais_uso: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      alm_materiais: {
        Row: {
          categoria: string | null
          codigo: string
          created_at: string
          estoque_atual: number
          estoque_minimo: number
          foto_path: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo: string
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          foto_path?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string
          created_at?: string
          estoque_atual?: number
          estoque_minimo?: number
          foto_path?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      alm_movimentacoes: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          equipe: string | null
          etapa_obra: string | null
          fornecedor: string | null
          foto_path: string | null
          id: string
          local_armazenamento: string | null
          local_uso: string | null
          material_id: string
          nf_foto_path: string | null
          nota_fiscal: string | null
          numero_requisicao: string | null
          observacoes: string | null
          preco_total: number | null
          preco_unitario: number | null
          quantidade: number
          responsavel: string | null
          saldo_apos: number
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          equipe?: string | null
          etapa_obra?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          id?: string
          local_armazenamento?: string | null
          local_uso?: string | null
          material_id: string
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          numero_requisicao?: string | null
          observacoes?: string | null
          preco_total?: number | null
          preco_unitario?: number | null
          quantidade?: number
          responsavel?: string | null
          saldo_apos?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          equipe?: string | null
          etapa_obra?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          id?: string
          local_armazenamento?: string | null
          local_uso?: string | null
          material_id?: string
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          numero_requisicao?: string | null
          observacoes?: string | null
          preco_total?: number | null
          preco_unitario?: number | null
          quantidade?: number
          responsavel?: string | null
          saldo_apos?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alm_movimentacoes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "alm_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      alm_setores: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      apontamentos_carga: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: string
          descricao_caminhao: string | null
          descricao_escavadeira: string | null
          empresa_caminhao: string | null
          empresa_escavadeira: string | null
          estaca: string | null
          hora: string | null
          id: string
          local: string | null
          material: string | null
          motorista: string | null
          operador: string | null
          prefixo_caminhao: string | null
          prefixo_escavadeira: string | null
          quantidade: number | null
          status: string | null
          updated_at: string | null
          viagens: number | null
          volume_total: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: string
          descricao_caminhao?: string | null
          descricao_escavadeira?: string | null
          empresa_caminhao?: string | null
          empresa_escavadeira?: string | null
          estaca?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          operador?: string | null
          prefixo_caminhao?: string | null
          prefixo_escavadeira?: string | null
          quantidade?: number | null
          status?: string | null
          updated_at?: string | null
          viagens?: number | null
          volume_total?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: string
          descricao_caminhao?: string | null
          descricao_escavadeira?: string | null
          empresa_caminhao?: string | null
          empresa_escavadeira?: string | null
          estaca?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          operador?: string | null
          prefixo_caminhao?: string | null
          prefixo_escavadeira?: string | null
          quantidade?: number | null
          status?: string | null
          updated_at?: string | null
          viagens?: number | null
          volume_total?: number | null
        }
        Relationships: []
      }
      apontamentos_descarga: {
        Row: {
          created_at: string | null
          data: string
          descricao_caminhao: string | null
          empresa_caminhao: string | null
          encarregado: string | null
          estaca: string | null
          external_id: string | null
          hora: string | null
          id: string
          local: string | null
          material: string | null
          motorista: string | null
          prefixo_caminhao: string | null
          updated_at: string | null
          usuario: string | null
          viagens: number | null
          volume: number | null
          volume_total: number | null
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao_caminhao?: string | null
          empresa_caminhao?: string | null
          encarregado?: string | null
          estaca?: string | null
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          prefixo_caminhao?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao_caminhao?: string | null
          empresa_caminhao?: string | null
          encarregado?: string | null
          estaca?: string | null
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          prefixo_caminhao?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Relationships: []
      }
      avatars: {
        Row: {
          created_at: string
          id: string
          path: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          user_id?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      evolucao_obra_execucoes: {
        Row: {
          area_executada: number | null
          camada: string
          camada_numero: number
          created_at: string
          data: string
          estaca_fim: string | null
          estaca_inicio: string
          faixa: string
          id: string
          observacoes: string | null
          volume_executado: number | null
        }
        Insert: {
          area_executada?: number | null
          camada: string
          camada_numero?: number
          created_at?: string
          data: string
          estaca_fim?: string | null
          estaca_inicio: string
          faixa: string
          id?: string
          observacoes?: string | null
          volume_executado?: number | null
        }
        Update: {
          area_executada?: number | null
          camada?: string
          camada_numero?: number
          created_at?: string
          data?: string
          estaca_fim?: string | null
          estaca_inicio?: string
          faixa?: string
          id?: string
          observacoes?: string | null
          volume_executado?: number | null
        }
        Relationships: []
      }
      fornecedores_cal: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      fornecedores_pedreira: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      locais: {
        Row: {
          created_at: string
          id: string
          nome: string
          obra: string | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          obra?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          obra?: string | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      materiais_pedreira: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: []
      }
      material: {
        Row: {
          created_at: string
          id: string
          material: string | null
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          material?: string | null
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          material?: string | null
          nome?: string
          status?: string
        }
        Relationships: []
      }
      movimentacoes_cal: {
        Row: {
          created_at: string | null
          data: string
          estaca: string | null
          external_id: string | null
          fornecedor: string | null
          foto_path: string | null
          hora: string | null
          id: string
          local: string | null
          motorista: string | null
          nf_foto_path: string | null
          nota_fiscal: string | null
          prefixo_caminhao: string | null
          quantidade: number | null
          updated_at: string | null
          usuario: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          estaca?: string | null
          external_id?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          motorista?: string | null
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          prefixo_caminhao?: string | null
          quantidade?: number | null
          updated_at?: string | null
          usuario?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          estaca?: string | null
          external_id?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          motorista?: string | null
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          prefixo_caminhao?: string | null
          quantidade?: number | null
          updated_at?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      movimentacoes_pedreira: {
        Row: {
          created_at: string | null
          data: string
          empresa_caminhao: string | null
          encarregado: string | null
          estaca: string | null
          external_id: string | null
          fornecedor: string | null
          foto_path: string | null
          hora: string | null
          id: string
          local: string | null
          material: string | null
          motorista: string | null
          nf_foto_path: string | null
          nota_fiscal: string | null
          prefixo_caminhao: string | null
          updated_at: string | null
          usuario: string | null
          viagens: number | null
          volume: number | null
          volume_total: number | null
        }
        Insert: {
          created_at?: string | null
          data: string
          empresa_caminhao?: string | null
          encarregado?: string | null
          estaca?: string | null
          external_id?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          prefixo_caminhao?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Update: {
          created_at?: string | null
          data?: string
          empresa_caminhao?: string | null
          encarregado?: string | null
          estaca?: string | null
          external_id?: string | null
          fornecedor?: string | null
          foto_path?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          motorista?: string | null
          nf_foto_path?: string | null
          nota_fiscal?: string | null
          prefixo_caminhao?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Relationships: []
      }
      movimentacoes_pipas: {
        Row: {
          atividade: string | null
          created_at: string | null
          data: string
          empresa: string | null
          external_id: string | null
          hora: string | null
          id: string
          local: string | null
          motorista: string | null
          prefixo_pipa: string | null
          updated_at: string | null
          usuario: string | null
          viagens: number | null
          volume: number | null
          volume_total: number | null
        }
        Insert: {
          atividade?: string | null
          created_at?: string | null
          data: string
          empresa?: string | null
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          motorista?: string | null
          prefixo_pipa?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Update: {
          atividade?: string | null
          created_at?: string | null
          data?: string
          empresa?: string | null
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          motorista?: string | null
          prefixo_pipa?: string | null
          updated_at?: string | null
          usuario?: string | null
          viagens?: number | null
          volume?: number | null
          volume_total?: number | null
        }
        Relationships: []
      }
      movimentacoes_usina_solos: {
        Row: {
          created_at: string | null
          data: string
          external_id: string | null
          hora: string | null
          id: string
          local: string | null
          material: string | null
          quantidade: number | null
          umidade: number | null
          updated_at: string | null
          usina: string | null
          usuario: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          quantidade?: number | null
          umidade?: number | null
          updated_at?: string | null
          usina?: string | null
          usuario?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          external_id?: string | null
          hora?: string | null
          id?: string
          local?: string | null
          material?: string | null
          quantidade?: number | null
          umidade?: number | null
          updated_at?: string | null
          usina?: string | null
          usuario?: string | null
        }
        Relationships: []
      }
      obra_config: {
        Row: {
          created_at: string
          id: string
          local: string | null
          logo_path: string | null
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          local?: string | null
          logo_path?: string | null
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          local?: string | null
          logo_path?: string | null
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_layout_configs: {
        Row: {
          block_key: string
          block_order: number
          created_at: string
          id: string
          page_key: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          block_key: string
          block_order?: number
          created_at?: string
          id?: string
          page_key: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          block_key?: string
          block_order?: number
          created_at?: string
          id?: string
          page_key?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      pedidos_compra_pedreira: {
        Row: {
          created_at: string
          created_by: string | null
          data_pedido: string | null
          fornecedor: string | null
          id: string
          material: string | null
          observacoes: string | null
          pdf_path: string | null
          quantidade_pedido: number | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_pedido?: string | null
          fornecedor?: string | null
          id?: string
          material?: string | null
          observacoes?: string | null
          pdf_path?: string | null
          quantidade_pedido?: number | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_pedido?: string | null
          fornecedor?: string | null
          id?: string
          material?: string | null
          observacoes?: string | null
          pdf_path?: string | null
          quantidade_pedido?: number | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pedreira_frete_materiais: {
        Row: {
          created_at: string
          id: string
          material: string
          preco_frete: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material: string
          preco_frete?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material?: string
          preco_frete?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          tipo: string
          user_id: string
          usuario: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          status?: string
          tipo?: string
          user_id: string
          usuario?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          status?: string
          tipo?: string
          user_id?: string
          usuario?: string | null
        }
        Relationships: []
      }
      rdo_efetivo: {
        Row: {
          created_at: string
          empresa: string | null
          funcao: string
          id: string
          periodo: string | null
          quantidade: number
          rdo_id: string
        }
        Insert: {
          created_at?: string
          empresa?: string | null
          funcao: string
          id?: string
          periodo?: string | null
          quantidade?: number
          rdo_id: string
        }
        Update: {
          created_at?: string
          empresa?: string | null
          funcao?: string
          id?: string
          periodo?: string | null
          quantidade?: number
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_efetivo_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_email_logs: {
        Row: {
          aprovador_num: number | null
          email: string | null
          error_message: string | null
          id: string
          obra_nome: string | null
          rdo_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          resend_id: string | null
          sent_at: string
          status: string | null
          subject: string | null
        }
        Insert: {
          aprovador_num?: number | null
          email?: string | null
          error_message?: string | null
          id?: string
          obra_nome?: string | null
          rdo_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string | null
          subject?: string | null
        }
        Update: {
          aprovador_num?: number | null
          email?: string | null
          error_message?: string | null
          id?: string
          obra_nome?: string | null
          rdo_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_email_logs_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_equipamentos: {
        Row: {
          created_at: string
          equipamento: string
          horas_trabalhadas: number | null
          id: string
          observacao: string | null
          prefixo: string | null
          rdo_id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          equipamento: string
          horas_trabalhadas?: number | null
          id?: string
          observacao?: string | null
          prefixo?: string | null
          rdo_id: string
          status?: string | null
        }
        Update: {
          created_at?: string
          equipamento?: string
          horas_trabalhadas?: number | null
          id?: string
          observacao?: string | null
          prefixo?: string | null
          rdo_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipamentos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_fotos: {
        Row: {
          created_at: string
          id: string
          legenda: string | null
          rdo_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          legenda?: string | null
          rdo_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          legenda?: string | null
          rdo_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_fotos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_obras: {
        Row: {
          aprovador1_cargo: string | null
          aprovador1_cpf: string | null
          aprovador1_email: string | null
          aprovador1_nome: string | null
          aprovador1_whatsapp: string | null
          aprovador2_cargo: string | null
          aprovador2_cpf: string | null
          aprovador2_email: string | null
          aprovador2_nome: string | null
          aprovador2_whatsapp: string | null
          aprovador3_cargo: string | null
          aprovador3_cpf: string | null
          aprovador3_email: string | null
          aprovador3_nome: string | null
          aprovador3_whatsapp: string | null
          cliente: string | null
          contrato: string | null
          created_at: string
          data_inicio_contrato: string | null
          data_prazo_contratual: string | null
          id: string
          licenca_canteiro: string | null
          nome: string
          prazo_contratual_dias: number | null
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aprovador1_cargo?: string | null
          aprovador1_cpf?: string | null
          aprovador1_email?: string | null
          aprovador1_nome?: string | null
          aprovador1_whatsapp?: string | null
          aprovador2_cargo?: string | null
          aprovador2_cpf?: string | null
          aprovador2_email?: string | null
          aprovador2_nome?: string | null
          aprovador2_whatsapp?: string | null
          aprovador3_cargo?: string | null
          aprovador3_cpf?: string | null
          aprovador3_email?: string | null
          aprovador3_nome?: string | null
          aprovador3_whatsapp?: string | null
          cliente?: string | null
          contrato?: string | null
          created_at?: string
          data_inicio_contrato?: string | null
          data_prazo_contratual?: string | null
          id?: string
          licenca_canteiro?: string | null
          nome: string
          prazo_contratual_dias?: number | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aprovador1_cargo?: string | null
          aprovador1_cpf?: string | null
          aprovador1_email?: string | null
          aprovador1_nome?: string | null
          aprovador1_whatsapp?: string | null
          aprovador2_cargo?: string | null
          aprovador2_cpf?: string | null
          aprovador2_email?: string | null
          aprovador2_nome?: string | null
          aprovador2_whatsapp?: string | null
          aprovador3_cargo?: string | null
          aprovador3_cpf?: string | null
          aprovador3_email?: string | null
          aprovador3_nome?: string | null
          aprovador3_whatsapp?: string | null
          cliente?: string | null
          contrato?: string | null
          created_at?: string
          data_inicio_contrato?: string | null
          data_prazo_contratual?: string | null
          id?: string
          licenca_canteiro?: string | null
          nome?: string
          prazo_contratual_dias?: number | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rdo_servicos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          observacao: string | null
          percentual: number | null
          rdo_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          observacao?: string | null
          percentual?: number | null
          rdo_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          observacao?: string | null
          percentual?: number | null
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_servicos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          aprovacao1_data: string | null
          aprovacao1_status: string | null
          aprovacao1_token: string | null
          aprovacao2_data: string | null
          aprovacao2_status: string | null
          aprovacao2_token: string | null
          aprovacao3_data: string | null
          aprovacao3_status: string | null
          aprovacao3_token: string | null
          clima_manha: string | null
          clima_tarde: string | null
          comentarios_construtora: string | null
          comentarios_fiscalizacao: string | null
          comentarios_gerenciadora: string | null
          condicao_tempo: string | null
          created_at: string
          created_by: string | null
          data: string
          data_inicio: string | null
          id: string
          novo_prazo_contratual: string | null
          numero_rdo: string | null
          obra_id: string | null
          observacoes: string | null
          pdf_path: string | null
          prazo_contratual: number | null
          prazo_decorrido: number | null
          prazo_restante: number | null
          prazo_restante_vigencia: number | null
          precipitacao_acumulada_mes: number | null
          precipitacao_dia: number | null
          status: string
          temperatura_manha: number | null
          temperatura_tarde: number | null
          termino_previsto: string | null
          updated_at: string
        }
        Insert: {
          aprovacao1_data?: string | null
          aprovacao1_status?: string | null
          aprovacao1_token?: string | null
          aprovacao2_data?: string | null
          aprovacao2_status?: string | null
          aprovacao2_token?: string | null
          aprovacao3_data?: string | null
          aprovacao3_status?: string | null
          aprovacao3_token?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          comentarios_construtora?: string | null
          comentarios_fiscalizacao?: string | null
          comentarios_gerenciadora?: string | null
          condicao_tempo?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          data_inicio?: string | null
          id?: string
          novo_prazo_contratual?: string | null
          numero_rdo?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pdf_path?: string | null
          prazo_contratual?: number | null
          prazo_decorrido?: number | null
          prazo_restante?: number | null
          prazo_restante_vigencia?: number | null
          precipitacao_acumulada_mes?: number | null
          precipitacao_dia?: number | null
          status?: string
          temperatura_manha?: number | null
          temperatura_tarde?: number | null
          termino_previsto?: string | null
          updated_at?: string
        }
        Update: {
          aprovacao1_data?: string | null
          aprovacao1_status?: string | null
          aprovacao1_token?: string | null
          aprovacao2_data?: string | null
          aprovacao2_status?: string | null
          aprovacao2_token?: string | null
          aprovacao3_data?: string | null
          aprovacao3_status?: string | null
          aprovacao3_token?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          comentarios_construtora?: string | null
          comentarios_fiscalizacao?: string | null
          comentarios_gerenciadora?: string | null
          condicao_tempo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          data_inicio?: string | null
          id?: string
          novo_prazo_contratual?: string | null
          numero_rdo?: string | null
          obra_id?: string | null
          observacoes?: string | null
          pdf_path?: string | null
          prazo_contratual?: number | null
          prazo_decorrido?: number | null
          prazo_restante?: number | null
          prazo_restante_vigencia?: number | null
          precipitacao_acumulada_mes?: number | null
          precipitacao_dia?: number | null
          status?: string
          temperatura_manha?: number | null
          temperatura_tarde?: number | null
          termino_previsto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "rdo_obras"
            referencedColumns: ["id"]
          },
        ]
      }
      report_header_configs: {
        Row: {
          created_at: string
          custom_title: string | null
          id: string
          report_key: string
          show_date: boolean | null
          show_filters: boolean | null
          show_logo: boolean | null
          show_obra_name: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_title?: string | null
          id?: string
          report_key: string
          show_date?: boolean | null
          show_filters?: boolean | null
          show_logo?: boolean | null
          show_obra_name?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_title?: string | null
          id?: string
          report_key?: string
          show_date?: boolean | null
          show_filters?: boolean | null
          show_logo?: boolean | null
          show_obra_name?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      sidebar_menu_configs: {
        Row: {
          created_at: string
          custom_label: string | null
          id: string
          menu_key: string
          menu_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          id?: string
          menu_key: string
          menu_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          id?: string
          menu_key?: string
          menu_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          status: string | null
          subject: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string | null
          subject?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: string | null
          subject?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
          sender_name: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      table_column_configs: {
        Row: {
          column_key: string
          column_order: number
          created_at: string
          custom_label: string | null
          id: string
          table_key: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          column_key: string
          column_order?: number
          created_at?: string
          custom_label?: string | null
          id?: string
          table_key: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          column_key?: string
          column_order?: number
          created_at?: string
          custom_label?: string | null
          id?: string
          table_key?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      table_conditional_formats: {
        Row: {
          bg_color: string | null
          column_key: string
          created_at: string
          id: string
          match_value: string | null
          table_key: string
        }
        Insert: {
          bg_color?: string | null
          column_key: string
          created_at?: string
          id?: string
          match_value?: string | null
          table_key: string
        }
        Update: {
          bg_color?: string | null
          column_key?: string
          created_at?: string
          id?: string
          match_value?: string | null
          table_key?: string
        }
        Relationships: []
      }
      user_equipment_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          equipment_prefixo: string
          equipment_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          equipment_prefixo: string
          equipment_type?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          equipment_prefixo?: string
          equipment_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_field_permissions: {
        Row: {
          created_at: string
          editable: boolean
          field_name: string
          id: string
          module: string
          user_id: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          editable?: boolean
          field_name: string
          id?: string
          module: string
          user_id: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          editable?: boolean
          field_name?: string
          id?: string
          module?: string
          user_id?: string
          visible?: boolean
        }
        Relationships: []
      }
      user_location_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          local_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          local_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          local_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_submenu_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          submenu_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          submenu_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          submenu_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      alm_atualizar_movimentacao: {
        Args: {
          p_data: string
          p_equipe?: string
          p_etapa_obra?: string
          p_fornecedor?: string
          p_foto_path?: string
          p_local_armazenamento?: string
          p_local_uso?: string
          p_material_id: string
          p_mov_id: string
          p_nf_foto_path?: string
          p_nota_fiscal?: string
          p_numero_requisicao?: string
          p_observacoes?: string
          p_preco_total?: number
          p_preco_unitario?: number
          p_quantidade: number
          p_responsavel?: string
        }
        Returns: string
      }
      alm_excluir_movimentacao: {
        Args: { p_mov_id: string }
        Returns: undefined
      }
      alm_registrar_movimentacao: {
        Args: {
          p_data: string
          p_equipe?: string
          p_etapa_obra?: string
          p_fornecedor?: string
          p_foto_path?: string
          p_local_armazenamento?: string
          p_local_uso?: string
          p_material_id: string
          p_nf_foto_path?: string
          p_nota_fiscal?: string
          p_numero_requisicao?: string
          p_observacoes?: string
          p_preco_total?: number
          p_preco_unitario?: number
          p_quantidade: number
          p_responsavel?: string
          p_tipo: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "apontador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "apontador"],
    },
  },
} as const
