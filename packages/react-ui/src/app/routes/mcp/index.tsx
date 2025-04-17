import {
  TriggerType,
  FlowOperationType,
  assertNotNullOrUndefined,
  Trigger,
  FlowOperationRequest,
  PopulatedFlow,
  Permission,
  ApFlagId,
  MCPPieceStatus,
  MCPPieceWithConnection,
} from '@activepieces/shared';
import { useQuery, useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { Hammer, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { McpClientTabs } from './mcp-client-tabs';
import { McpToolsSection } from './mcp-tools-section';

import { pieceSelectorUtils } from '@/app/builder/pieces-selector/piece-selector-utils';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TableTitle } from '@/components/ui/table-title';
import { useToast } from '@/components/ui/use-toast';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { mcpApi } from '@/features/mcp/mcp-api';
import { piecesHooks } from '@/features/pieces/lib/pieces-hook';
import {
  PieceStepMetadataWithSuggestions,
  StepMetadata,
} from '@/features/pieces/lib/types';
import { useAuthorization } from '@/hooks/authorization-hooks';
import { flagsHooks } from '@/hooks/flags-hooks';
import { authenticationSession } from '@/lib/authentication-session';

export default function MCPPage() {
  const { theme } = useTheme();
  const { data: publicUrl } = flagsHooks.useFlag(ApFlagId.PUBLIC_URL);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { checkAccess } = useAuthorization();
  const doesUserHavePermissionToWriteFlow = checkAccess(Permission.WRITE_FLOW);
  const { metadata } = piecesHooks.useAllStepsMetadata({
    searchQuery: '',
    type: 'trigger',
  });

  const {
    data: mcp,
    refetch: refetchMcp,
    isLoading,
  } = useQuery({
    queryKey: ['mcp'],
    queryFn: () => {
      return mcpApi.get();
    },
  });

  const { data: flowsData, isLoading: isFlowsLoading } = useQuery({
    queryKey: ['mcp-flows'],
    queryFn: () => {
      return flowsApi
        .list({
          projectId: authenticationSession.getProjectId()!,
          limit: 100,
          cursor: undefined,
        })
        .then((flows) => {
          const flowsData = flows.data.filter(
            (flow) =>
              flow.version.trigger.type === TriggerType.PIECE &&
              flow.version.trigger.settings.pieceName ===
                '@activepieces/piece-mcp',
          );
          return {
            ...flows,
            data: flowsData,
          };
        });
    },
  });

  const serverUrl =
    publicUrl + 'api/v1/mcp-servers/' + (mcp?.token || '') + '/sse';

  const { pieces } = piecesHooks.usePieces({});

  const addPieceMutation = useMutation({
    mutationFn: async ({
      mcpId,
      pieceName,
      connectionId,
    }: {
      mcpId: string;
      pieceName: string;
      connectionId?: string;
    }) => {
      return mcpApi.addPiece({
        mcpId,
        pieceName,
        connectionId,
        status: MCPPieceStatus.ENABLED,
      });
    },
    onSuccess: () => {
      toast({
        description: t('Piece is added successfully'),
        duration: 3000,
      });
      refetchMcp();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('Error'),
        description: t('Failed to add piece'),
        duration: 5000,
      });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async (mcpId: string) => {
      return mcpApi.rotateToken(mcpId);
    },
    onSuccess: () => {
      toast({
        description: t('Token rotated successfully'),
        duration: 3000,
      });
      refetchMcp();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('Error'),
        description: t('Failed to rotate token'),
        duration: 5000,
      });
    },
  });

  const removePieceMutation = useMutation({
    mutationFn: async (pieceId: string) => {
      return mcpApi.deletePiece(pieceId);
    },
    onSuccess: () => {
      toast({
        description: t('Piece removed successfully'),
        duration: 3000,
      });
      refetchMcp();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('Error'),
        description: t('Failed to remove piece'),
        duration: 5000,
      });
    },
  });

  const { mutate: createFlow, isPending: isCreateFlowPending } = useMutation({
    mutationFn: async () => {
      const flow = await flowsApi.create({
        projectId: authenticationSession.getProjectId()!,
        displayName: t('Untitled'),
      });
      return flow;
    },
    onSuccess: async (flow) => {
      const triggerMetadata = metadata?.find(
        (m) =>
          (m as PieceStepMetadataWithSuggestions).pieceName ===
          '@activepieces/piece-mcp',
      );
      const trigger = (
        triggerMetadata as PieceStepMetadataWithSuggestions
      )?.suggestedTriggers?.find((t: any) => t.name === 'mcp_tool');
      assertNotNullOrUndefined(trigger, 'Trigger not found');
      const stepData = pieceSelectorUtils.getDefaultStep({
        stepName: 'trigger',
        stepMetadata: triggerMetadata as StepMetadata,
        actionOrTrigger: trigger,
      });
      await applyOperation(flow, {
        type: FlowOperationType.UPDATE_TRIGGER,
        request: stepData as Trigger,
      });
      toast({
        description: t('Flow created successfully'),
        duration: 3000,
      });
      navigate(`/flows/${flow.id}`);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: t('Error'),
        description: t('Failed to create flow'),
        duration: 5000,
      });
    },
  });

  const applyOperation = async (
    flow: PopulatedFlow,
    operation: FlowOperationRequest,
  ) => {
    try {
      const updatedFlowVersion = await flowsApi.update(
        flow.id,
        operation,
        true,
      );
      return {
        flowVersion: {
          ...flow.version,
          id: updatedFlowVersion.version.id,
          state: updatedFlowVersion.version.state,
        },
      };
    } catch (error) {
      console.error(error);
    }
  };

  const removePiece = async (piece: MCPPieceWithConnection) => {
    if (!mcp?.id || removePieceMutation.isPending) return;
    removePieceMutation.mutate(piece.id);
  };

  const handleRotateToken = () => {
    if (!mcp?.id) return;
    rotateMutation.mutate(mcp.id);
  };

  const getPieceInfo = (piece: MCPPieceWithConnection) => {
    const pieceMetadata = pieces?.find((p) => p.name === piece.pieceName);

    return {
      displayName: pieceMetadata?.displayName || piece.pieceName,
      logoUrl: pieceMetadata?.logoUrl,
    };
  };

  const addPiece = (pieceName: string, connectionId?: string) => {
    if (!mcp?.id) return;

    addPieceMutation.mutate({
      mcpId: mcp.id,
      pieceName,
      connectionId,
    });
  };

  const pieceInfoMap: Record<
    string,
    { displayName: string; logoUrl?: string }
  > = {};
  mcp?.pieces?.forEach((piece) => {
    pieceInfoMap[piece.id] = getPieceInfo(piece);
  });

  const emptyFlowsMessage = (
    <div className="flex">
      <div
        className={`w-64 flex flex-col items-center justify-center py-6 px-5 text-muted-foreground ${
          theme === 'dark' ? 'bg-card border-border' : 'bg-white'
        } rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
        onClick={() => createFlow()}
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className={`rounded-full ${
              theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
            } p-2.5 mb-1`}
          >
            <Plus
              className={`h-5 w-5 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              }`}
            />
          </div>
          <p
            className={`font-medium ${
              theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {t('Add Flow')}
          </p>
          <p
            className={`text-xs mt-0.5 text-center ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {t('Let your AI assistant trigger automations')}
          </p>
        </div>
        <Button
          className="sr-only"
          disabled={!doesUserHavePermissionToWriteFlow || isCreateFlowPending}
          onClick={() => createFlow()}
        >
          {t('Create Your First MCP Flow')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center justify-center gap-8 pb-12">
      <div className="w-full space-y-8">
        <div className="flex items-center gap-2">
          <TableTitle
            beta={true}
            description={t(
              'Connect to your hosted MCP Server using any MCP client to communicate with tools',
            )}
          >
            {t('MCP Server')}
          </TableTitle>
        </div>

        {/* Client Setup Instructions at the top */}
        {!isFlowsLoading && !isLoading && (
          <McpClientTabs
            mcpServerUrl={serverUrl}
            hasTools={
              (mcp?.pieces?.length || 0) > 0 ||
              (flowsData?.data?.length || 0) > 0
            }
            onRotateToken={handleRotateToken}
            isRotating={rotateMutation.isPending}
            hasValidMcp={!!mcp?.id}
          />
        )}

        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">{t('My Tools')}</span>
          </div>

          {/* Pieces Section */}
          <McpToolsSection
            title={t('Pieces')}
            tools={mcp?.pieces || []}
            emptyMessage={null}
            isLoading={isLoading}
            type="pieces"
            onAddClick={() => {}}
            onToolDelete={removePiece}
            pieceInfoMap={pieceInfoMap}
            canAddTool={true}
            addButtonLabel={t('Add Piece')}
            isPending={
              removePieceMutation.isPending || addPieceMutation.isPending
            }
            onPieceSelected={addPiece}
          />

          {/* Flows Section */}
          <Separator className="w-full my-4" />

          <McpToolsSection
            title={t('Flows')}
            tools={flowsData?.data || []}
            emptyMessage={emptyFlowsMessage}
            isLoading={isFlowsLoading}
            type="flows"
            onAddClick={() => createFlow()}
            onToolClick={(flow) => navigate(`/flows/${flow.id}`)}
            canAddTool={doesUserHavePermissionToWriteFlow}
            addButtonLabel={t('Create Flow')}
            isPending={isCreateFlowPending}
          />
        </div>
      </div>
    </div>
  );
}
