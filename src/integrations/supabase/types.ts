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
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          section: string
          updated_at: string | null
          user_type: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          section: string
          updated_at?: string | null
          user_type: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          section?: string
          updated_at?: string | null
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nome?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          status?: string
          tipo?: string
          updated_at?: string
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
          data?: string
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
          quantidade: number
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
      empresas: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      evolucao_obra_execucoes: {
        Row: {
          area_executada: number
          camada: string
          camada_numero: number
          created_at: string
          created_by: string | null
          data: string
          estaca_fim: number
          estaca_inicio: number
          faixa: number
          id: string
          observacoes: string | null
          updated_at: string
          volume_executado: number
        }
        Insert: {
          area_executada?: number
          camada: string
          camada_numero?: number
          created_at?: string
          created_by?: string | null
          data?: string
          estaca_fim: number
          estaca_inicio: number
          faixa: number
          id?: string
          observacoes?: string | null
          updated_at?: string
          volume_executado?: number
        }
        Update: {
          area_executada?: number
          camada?: string
          camada_numero?: number
          created_at?: string
          created_by?: string | null
          data?: string
          estaca_fim?: number
          estaca_inicio?: number
          faixa?: number
          id?: string
          observacoes?: string | null
          updated_at?: string
          volume_executado?: number
        }
        Relationships: []
      }
      execucoes_retigrafico: {
        Row: {
          area_executada: number
          created_at: string
          created_by: string | null
          data: string
          id: string
          obra_id: string
          quantidade_executada: number
          servico_id: string
          trecho_id: string
          updated_at: string
        }
        Insert: {
          area_executada?: number
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          obra_id: string
          quantidade_executada?: number
          servico_id: string
          trecho_id: string
          updated_at?: string
        }
        Update: {
          area_executada?: number
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          obra_id?: string
          quantidade_executada?: number
          servico_id?: string
          trecho_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucoes_retigrafico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras_retigrafico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_retigrafico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_retigrafico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execucoes_retigrafico_trecho_id_fkey"
            columns: ["trecho_id"]
            isOneToOne: false
            referencedRelation: "trechos_retigrafico"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_cal: {
        Row: {
          cnpj: string | null
          contato: string | null
          created_at: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
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
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      locais: {
        Row: {
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          obra: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          obra?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          obra?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      materiais: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      materiais_pedreira: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      obra_config: {
        Row: {
          created_at: string
          id: string
          local: string
          logo_path: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          local?: string
          logo_path?: string | null
          nome?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          local?: string
          logo_path?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      obras_retigrafico: {
        Row: {
          area_prevista: number | null
          contrato: string | null
          created_at: string
          data_inicio: string | null
          data_prevista_termino: string | null
          estaca_final: string | null
          estaca_inicial: string | null
          extensao_total: number | null
          id: string
          nome: string
          observacoes: string | null
          planta_path: string | null
          prazo_previsto_dias: number | null
          responsavel: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_prevista?: number | null
          contrato?: string | null
          created_at?: string
          data_inicio?: string | null
          data_prevista_termino?: string | null
          estaca_final?: string | null
          estaca_inicial?: string | null
          extensao_total?: number | null
          id?: string
          nome: string
          observacoes?: string | null
          planta_path?: string | null
          prazo_previsto_dias?: number | null
          responsavel?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_prevista?: number | null
          contrato?: string | null
          created_at?: string
          data_inicio?: string | null
          data_prevista_termino?: string | null
          estaca_final?: string | null
          estaca_inicial?: string | null
          extensao_total?: number | null
          id?: string
          nome?: string
          observacoes?: string | null
          planta_path?: string | null
          prazo_previsto_dias?: number | null
          responsavel?: string | null
          status?: string
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
          fornecedor: string
          id: string
          material: string
          observacoes: string | null
          pdf_path: string | null
          quantidade_pedido: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fornecedor: string
          id?: string
          material: string
          observacoes?: string | null
          pdf_path?: string | null
          quantidade_pedido?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fornecedor?: string
          id?: string
          material?: string
          observacoes?: string | null
          pdf_path?: string | null
          quantidade_pedido?: number
          updated_at?: string
        }
        Relationships: []
      }
      pedreira_frete_materiais: {
        Row: {
          created_at: string
          id: string
          material: string
          preco_frete: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material: string
          preco_frete?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material?: string
          preco_frete?: number
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
          user_id?: string
          usuario?: string | null
        }
        Relationships: []
      }
      rdo_efetivo: {
        Row: {
          created_at: string
          empresa: string
          funcao: string
          id: string
          periodo: string | null
          quantidade: number
          rdo_id: string
        }
        Insert: {
          created_at?: string
          empresa: string
          funcao: string
          id?: string
          periodo?: string | null
          quantidade?: number
          rdo_id: string
        }
        Update: {
          created_at?: string
          empresa?: string
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
          aprovador_num: number
          email: string
          error_message: string | null
          id: string
          obra_nome: string | null
          rdo_id: string
          resend_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          aprovador_num: number
          email: string
          error_message?: string | null
          id?: string
          obra_nome?: string | null
          rdo_id: string
          resend_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          aprovador_num?: number
          email?: string
          error_message?: string | null
          id?: string
          obra_nome?: string | null
          rdo_id?: string
          resend_id?: string | null
          sent_at?: string
          status?: string
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
          asv: string | null
          cliente: string | null
          contrato: string | null
          created_at: string
          data_inicio_contrato: string | null
          data_prazo_contratual: string | null
          data_publicacao: string | null
          dias_aditados: number | null
          dias_paralisados: number | null
          id: string
          licenca_ambiental: string | null
          licenca_canteiro: string | null
          nome: string
          novo_prazo_contratual: string | null
          objeto: string | null
          outorgas_agua: string | null
          prazo_contratual_dias: number | null
          responsavel: string | null
          status: string
          updated_at: string
          usina_cbuq: boolean | null
          usina_concreto: boolean | null
          usina_solos: boolean | null
          vigencia_final: string | null
          vigencia_inicial: string | null
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
          asv?: string | null
          cliente?: string | null
          contrato?: string | null
          created_at?: string
          data_inicio_contrato?: string | null
          data_prazo_contratual?: string | null
          data_publicacao?: string | null
          dias_aditados?: number | null
          dias_paralisados?: number | null
          id?: string
          licenca_ambiental?: string | null
          licenca_canteiro?: string | null
          nome: string
          novo_prazo_contratual?: string | null
          objeto?: string | null
          outorgas_agua?: string | null
          prazo_contratual_dias?: number | null
          responsavel?: string | null
          status?: string
          updated_at?: string
          usina_cbuq?: boolean | null
          usina_concreto?: boolean | null
          usina_solos?: boolean | null
          vigencia_final?: string | null
          vigencia_inicial?: string | null
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
          asv?: string | null
          cliente?: string | null
          contrato?: string | null
          created_at?: string
          data_inicio_contrato?: string | null
          data_prazo_contratual?: string | null
          data_publicacao?: string | null
          dias_aditados?: number | null
          dias_paralisados?: number | null
          id?: string
          licenca_ambiental?: string | null
          licenca_canteiro?: string | null
          nome?: string
          novo_prazo_contratual?: string | null
          objeto?: string | null
          outorgas_agua?: string | null
          prazo_contratual_dias?: number | null
          responsavel?: string | null
          status?: string
          updated_at?: string
          usina_cbuq?: boolean | null
          usina_concreto?: boolean | null
          usina_solos?: boolean | null
          vigencia_final?: string | null
          vigencia_inicial?: string | null
        }
        Relationships: []
      }
      rdo_servicos: {
        Row: {
          created_at: string
          descricao: string
          id: string
          local_servico: string | null
          quantidade_executada: number | null
          quantidade_prevista: number | null
          rdo_id: string
          unidade: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          local_servico?: string | null
          quantidade_executada?: number | null
          quantidade_prevista?: number | null
          rdo_id: string
          unidade?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          local_servico?: string | null
          quantidade_executada?: number | null
          quantidade_prevista?: number | null
          rdo_id?: string
          unidade?: string | null
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
          aprovacao1_observacao: string | null
          aprovacao1_status: string | null
          aprovacao1_token: string | null
          aprovacao2_data: string | null
          aprovacao2_observacao: string | null
          aprovacao2_status: string | null
          aprovacao2_token: string | null
          aprovacao3_data: string | null
          aprovacao3_observacao: string | null
          aprovacao3_status: string | null
          aprovacao3_token: string | null
          assinatura1_path: string | null
          assinatura2_path: string | null
          assinatura3_path: string | null
          clima_manha: string | null
          clima_tarde: string | null
          comentarios_construtora: string | null
          comentarios_fiscalizacao: string | null
          comentarios_gerenciadora: string | null
          condicao_tempo: string | null
          created_at: string
          created_by: string
          data: string
          data_inicio: string | null
          id: string
          novo_prazo_contratual: string | null
          numero_rdo: string | null
          obra_id: string
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
          aprovacao1_observacao?: string | null
          aprovacao1_status?: string | null
          aprovacao1_token?: string | null
          aprovacao2_data?: string | null
          aprovacao2_observacao?: string | null
          aprovacao2_status?: string | null
          aprovacao2_token?: string | null
          aprovacao3_data?: string | null
          aprovacao3_observacao?: string | null
          aprovacao3_status?: string | null
          aprovacao3_token?: string | null
          assinatura1_path?: string | null
          assinatura2_path?: string | null
          assinatura3_path?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          comentarios_construtora?: string | null
          comentarios_fiscalizacao?: string | null
          comentarios_gerenciadora?: string | null
          condicao_tempo?: string | null
          created_at?: string
          created_by: string
          data: string
          data_inicio?: string | null
          id?: string
          novo_prazo_contratual?: string | null
          numero_rdo?: string | null
          obra_id: string
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
          aprovacao1_observacao?: string | null
          aprovacao1_status?: string | null
          aprovacao1_token?: string | null
          aprovacao2_data?: string | null
          aprovacao2_observacao?: string | null
          aprovacao2_status?: string | null
          aprovacao2_token?: string | null
          aprovacao3_data?: string | null
          aprovacao3_observacao?: string | null
          aprovacao3_status?: string | null
          aprovacao3_token?: string | null
          assinatura1_path?: string | null
          assinatura2_path?: string | null
          assinatura3_path?: string | null
          clima_manha?: string | null
          clima_tarde?: string | null
          comentarios_construtora?: string | null
          comentarios_fiscalizacao?: string | null
          comentarios_gerenciadora?: string | null
          condicao_tempo?: string | null
          created_at?: string
          created_by?: string
          data?: string
          data_inicio?: string | null
          id?: string
          novo_prazo_contratual?: string | null
          numero_rdo?: string | null
          obra_id?: string
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
          date_font_size: number
          header_gap: number
          header_padding_bottom: number
          header_padding_left: number
          header_padding_right: number
          header_padding_top: number
          id: string
          logo_height: number
          logo_visible: boolean
          report_key: string
          stats_gap: number
          stats_margin_bottom: number
          subtitle_font_size: number
          title_font_size: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_font_size?: number
          header_gap?: number
          header_padding_bottom?: number
          header_padding_left?: number
          header_padding_right?: number
          header_padding_top?: number
          id?: string
          logo_height?: number
          logo_visible?: boolean
          report_key: string
          stats_gap?: number
          stats_margin_bottom?: number
          subtitle_font_size?: number
          title_font_size?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_font_size?: number
          header_gap?: number
          header_padding_bottom?: number
          header_padding_left?: number
          header_padding_right?: number
          header_padding_top?: number
          id?: string
          logo_height?: number
          logo_visible?: boolean
          report_key?: string
          stats_gap?: number
          stats_margin_bottom?: number
          subtitle_font_size?: number
          title_font_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      retigrafico_overlay_areas: {
        Row: {
          created_at: string
          id: string
          obra_id: string
          polygon_data: Json
          trecho_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obra_id: string
          polygon_data?: Json
          trecho_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obra_id?: string
          polygon_data?: Json
          trecho_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retigrafico_overlay_areas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras_retigrafico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retigrafico_overlay_areas_trecho_id_fkey"
            columns: ["trecho_id"]
            isOneToOne: false
            referencedRelation: "trechos_retigrafico"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_retigrafico: {
        Row: {
          created_at: string
          id: string
          nome: string
          status: string
          unidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          status?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          conversation_type: string
          created_at: string
          id: string
          last_message_at: string
          recipient_email: string | null
          recipient_id: string | null
          recipient_name: string | null
          status: string
          subject: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          conversation_type?: string
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name: string
        }
        Update: {
          conversation_type?: string
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string
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
          sender_id: string
          sender_name: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name: string
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
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
          bg_color: string | null
          column_key: string
          column_order: number
          created_at: string
          custom_label: string | null
          font_bold: boolean
          font_family: string | null
          font_italic: boolean
          font_size: string | null
          header_bg_color: string | null
          header_font_bold: boolean
          header_font_family: string | null
          header_font_italic: boolean
          header_font_size: string | null
          header_icon_name: string | null
          header_letter_spacing: string | null
          header_text_align: string | null
          header_text_color: string | null
          header_text_transform: string | null
          icon_name: string | null
          id: string
          letter_spacing: string | null
          table_key: string
          text_align: string | null
          text_color: string | null
          text_transform: string | null
          updated_at: string
          visible: boolean
        }
        Insert: {
          bg_color?: string | null
          column_key: string
          column_order?: number
          created_at?: string
          custom_label?: string | null
          font_bold?: boolean
          font_family?: string | null
          font_italic?: boolean
          font_size?: string | null
          header_bg_color?: string | null
          header_font_bold?: boolean
          header_font_family?: string | null
          header_font_italic?: boolean
          header_font_size?: string | null
          header_icon_name?: string | null
          header_letter_spacing?: string | null
          header_text_align?: string | null
          header_text_color?: string | null
          header_text_transform?: string | null
          icon_name?: string | null
          id?: string
          letter_spacing?: string | null
          table_key: string
          text_align?: string | null
          text_color?: string | null
          text_transform?: string | null
          updated_at?: string
          visible?: boolean
        }
        Update: {
          bg_color?: string | null
          column_key?: string
          column_order?: number
          created_at?: string
          custom_label?: string | null
          font_bold?: boolean
          font_family?: string | null
          font_italic?: boolean
          font_size?: string | null
          header_bg_color?: string | null
          header_font_bold?: boolean
          header_font_family?: string | null
          header_font_italic?: boolean
          header_font_size?: string | null
          header_icon_name?: string | null
          header_letter_spacing?: string | null
          header_text_align?: string | null
          header_text_color?: string | null
          header_text_transform?: string | null
          icon_name?: string | null
          id?: string
          letter_spacing?: string | null
          table_key?: string
          text_align?: string | null
          text_color?: string | null
          text_transform?: string | null
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      table_conditional_formats: {
        Row: {
          bg_color: string
          column_key: string
          created_at: string
          id: string
          match_value: string
          table_key: string
          text_color: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string
          column_key: string
          created_at?: string
          id?: string
          match_value: string
          table_key: string
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string
          column_key?: string
          created_at?: string
          id?: string
          match_value?: string
          table_key?: string
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trechos_retigrafico: {
        Row: {
          area: number | null
          created_at: string
          estaca_final: number | null
          estaca_inicial: number | null
          extensao: number | null
          id: string
          largura: number | null
          nome: string
          obra_id: string
          status: string
          updated_at: string
        }
        Insert: {
          area?: number | null
          created_at?: string
          estaca_final?: number | null
          estaca_inicial?: number | null
          extensao?: number | null
          id?: string
          largura?: number | null
          nome: string
          obra_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          area?: number | null
          created_at?: string
          estaca_final?: number | null
          estaca_inicial?: number | null
          extensao?: number | null
          id?: string
          largura?: number | null
          nome?: string
          obra_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trechos_retigrafico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras_retigrafico"
            referencedColumns: ["id"]
          },
        ]
      }
      user_equipment_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          equipment_prefixo: string
          equipment_type: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          equipment_prefixo: string
          equipment_type: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          equipment_prefixo?: string
          equipment_type?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_field_permissions: {
        Row: {
          can_edit: boolean | null
          created_at: string | null
          editable: boolean | null
          field_name: string
          id: string
          module: string
          updated_at: string | null
          user_id: string
          visible: boolean | null
        }
        Insert: {
          can_edit?: boolean | null
          created_at?: string | null
          editable?: boolean | null
          field_name: string
          id?: string
          module: string
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
        }
        Update: {
          can_edit?: boolean | null
          created_at?: string | null
          editable?: boolean | null
          field_name?: string
          id?: string
          module?: string
          updated_at?: string | null
          user_id?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      user_location_permissions: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          local_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          local_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          submenu_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          submenu_key?: string
          updated_at?: string
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
        Returns: Json
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
        Returns: Json
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_module_permission: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_submenu_permission: {
        Args: { _submenu_key: string; _user_id: string }
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
