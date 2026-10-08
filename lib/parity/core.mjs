const SUPPORT_LEVELS = Object.freeze([
  "full",
  "guided",
  "secure-link",
  "staff-transfer",
  "not-applicable",
]);

const CHANNELS = Object.freeze(["web", "ivr", "sms"]);

function defineWorkflow(definition) {
  return Object.freeze({
    ...definition,
    support: Object.freeze({ ...definition.support }),
  });
}

export const workflowParityMatrix = Object.freeze([
  defineWorkflow({
    id: "reservation.search",
    title: "Search availability and start a reservation",
    audience: "guest",
    command: "reservation.search",
    support: { web: "full", ivr: "guided", sms: "guided" },
  }),
  defineWorkflow({
    id: "reservation.manage",
    title: "Review or change an existing reservation",
    audience: "guest",
    command: "reservation.manage",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "accommodation.info",
    title: "Review campsite or cottage information",
    audience: "guest",
    command: "accommodation.info",
    support: { web: "full", ivr: "guided", sms: "guided" },
  }),
  defineWorkflow({
    id: "visitor.register",
    title: "Register a visitor",
    audience: "guest",
    command: "visitor.register",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "vehicle.register",
    title: "Register a vehicle",
    audience: "guest",
    command: "vehicle.register",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "assistance.request",
    title: "Request camper assistance",
    audience: "guest",
    command: "assistance.request",
    support: { web: "full", ivr: "guided", sms: "guided" },
  }),
  defineWorkflow({
    id: "store.order",
    title: "Order common store or campsite services",
    audience: "guest",
    command: "store.order",
    support: { web: "full", ivr: "guided", sms: "guided" },
  }),
  defineWorkflow({
    id: "events.list",
    title: "Review campground events and local interests",
    audience: "guest",
    command: "events.list",
    support: { web: "full", ivr: "guided", sms: "guided" },
  }),
  defineWorkflow({
    id: "rental.manage",
    title: "Check or manage rentals and waterfront services",
    audience: "guest",
    command: "rental.manage",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "payment.complete",
    title: "Complete a payment step",
    audience: "guest",
    command: "payment.complete",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    reason:
      "Raw card data must never be collected by the custom iCamp IVR or SMS conversation.",
    secureLinkPurpose: "hosted-payment",
  }),
  defineWorkflow({
    id: "work-order.assignment.respond",
    title: "Accept or decline a work-order assignment",
    audience: "staff",
    command: "work-order.assignment.respond",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "work-order.status.update",
    title: "Update a work-order status",
    audience: "staff",
    command: "work-order.status.update",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "inspection.checklist.complete",
    title: "Complete checklist answers",
    audience: "staff",
    command: "inspection.checklist.complete",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "defect.report",
    title: "Report an operational defect",
    audience: "staff",
    command: "defect.report",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "asset.status.query",
    title: "Query a site or asset status",
    audience: "staff",
    command: "asset.status.query",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "staff.note.record",
    title: "Record a short operational note",
    audience: "staff",
    command: "staff.note.record",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "alert.acknowledge",
    title: "Acknowledge an operational alert",
    audience: "staff",
    command: "alert.acknowledge",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "operations.status.query",
    title: "Query management operating status",
    audience: "management",
    command: "operations.status.query",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "closure.manage",
    title: "Manage a campground closure",
    audience: "management",
    command: "closure.manage",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    requiresVerification: true,
    secureLinkPurpose: "privileged-management",
    reason:
      "Closure changes require a protected confirmation surface and audit context.",
  }),
  defineWorkflow({
    id: "gate.state.query",
    title: "Query gate state",
    audience: "management",
    command: "gate.state.query",
    support: { web: "full", ivr: "guided", sms: "guided" },
    requiresVerification: true,
  }),
  defineWorkflow({
    id: "gate.override",
    title: "Issue a manual gate override",
    audience: "management",
    command: "gate.override",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    requiresVerification: true,
    secureLinkPurpose: "privileged-gate-control",
    reason:
      "A gate override is high risk and must preserve privileged confirmation and audit controls.",
  }),
  defineWorkflow({
    id: "refund.issue",
    title: "Issue a refund",
    audience: "management",
    command: "refund.issue",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    requiresVerification: true,
    secureLinkPurpose: "privileged-finance",
    reason:
      "Refunds require a protected authenticated surface and may require approval.",
  }),
  defineWorkflow({
    id: "permissions.manage",
    title: "Manage staff permissions",
    audience: "management",
    command: "permissions.manage",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    requiresVerification: true,
    secureLinkPurpose: "privileged-authorization",
    reason:
      "Permission changes require a protected visual review and privileged action controls.",
  }),
  defineWorkflow({
    id: "map.polygon.edit",
    title: "Draw or edit map polygons",
    audience: "management",
    command: "map.polygon.edit",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    visualOnly: true,
    secureLinkPurpose: "graphical-map-edit",
    reason:
      "Polygon drawing is inherently graphical; telephone and SMS can only hand off to the protected visual editor.",
  }),
  defineWorkflow({
    id: "map.label.position",
    title: "Position labels on the campground map",
    audience: "management",
    command: "map.label.position",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    visualOnly: true,
    secureLinkPurpose: "graphical-map-edit",
    reason:
      "Visual positioning has no honest numeric-keypad equivalent.",
  }),
  defineWorkflow({
    id: "media.gallery.view",
    title: "View accommodation or asset photographs",
    audience: "guest",
    command: "media.gallery.view",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    visualOnly: true,
    secureLinkPurpose: "authorized-media-view",
    reason:
      "Photographs require a visual surface; voice can describe the object or transfer to staff.",
  }),
  defineWorkflow({
    id: "dashboard.chart.inspect",
    title: "Inspect a graphical report or chart",
    audience: "management",
    command: "dashboard.chart.inspect",
    support: {
      web: "full",
      ivr: "staff-transfer",
      sms: "secure-link",
    },
    visualOnly: true,
    secureLinkPurpose: "protected-report-view",
    reason:
      "Charts are visual; non-visual channels can receive a summary or protected handoff.",
  }),
]);

const workflowById = new Map(
  workflowParityMatrix.map((workflow) => [workflow.id, workflow]),
);

export function getWorkflowDefinition(workflowId) {
  const workflow = workflowById.get(workflowId);
  if (!workflow) {
    throw new Error("unknown_workflow:" + workflowId);
  }
  return workflow;
}

export function assertWorkflowParityRegistry() {
  const ids = new Set();

  for (const workflow of workflowParityMatrix) {
    if (!workflow.id || !workflow.command || !workflow.audience) {
      throw new Error("invalid_workflow_definition");
    }
    if (ids.has(workflow.id)) {
      throw new Error("duplicate_workflow:" + workflow.id);
    }
    ids.add(workflow.id);

    for (const channel of CHANNELS) {
      if (!SUPPORT_LEVELS.includes(workflow.support[channel])) {
        throw new Error(
          "invalid_support_level:" + workflow.id + ":" + channel,
        );
      }
    }

    if (
      workflow.support.ivr === "not-applicable" &&
      workflow.support.sms === "not-applicable" &&
      !workflow.visualOnly
    ) {
      throw new Error("accidental_web_only_workflow:" + workflow.id);
    }

    if (
      (workflow.visualOnly ||
        workflow.support.ivr === "not-applicable" ||
        workflow.support.sms === "not-applicable") &&
      !workflow.reason
    ) {
      throw new Error("missing_channel_exception_reason:" + workflow.id);
    }
  }

  return true;
}

async function routeFallback({
  channel,
  workflow,
  request,
  createSecureLink,
  requestStaffTransfer,
  reason,
}) {
  if (channel === "sms" && createSecureLink && workflow.secureLinkPurpose) {
    const handoff = await createSecureLink({
      workflowId: workflow.id,
      purpose: workflow.secureLinkPurpose,
      actor: request.actor,
      campgroundId: request.campgroundId,
      context: request.context ?? {},
    });
    return {
      kind: "secure-link",
      workflowId: workflow.id,
      channel,
      support: "secure-link",
      handoff,
      reason,
    };
  }

  if (createSecureLink && workflow.secureLinkPurpose) {
    const handoff = await createSecureLink({
      workflowId: workflow.id,
      purpose: workflow.secureLinkPurpose,
      actor: request.actor,
      campgroundId: request.campgroundId,
      context: request.context ?? {},
    });
    return {
      kind: "secure-link",
      workflowId: workflow.id,
      channel,
      support: "secure-link",
      handoff,
      reason,
    };
  }

  if (requestStaffTransfer) {
    const transfer = await requestStaffTransfer({
      workflowId: workflow.id,
      actor: request.actor,
      campgroundId: request.campgroundId,
      context: request.context ?? {},
      reason,
    });
    return {
      kind: "staff-transfer",
      workflowId: workflow.id,
      channel,
      support: "staff-transfer",
      transfer,
      reason,
    };
  }

  throw new Error("workflow_fallback_unavailable:" + workflow.id);
}

function createWorkflowAdapter({
  channel,
  executeCanonicalCommand,
  createSecureLink,
  requestStaffTransfer,
}) {
  if (channel !== "ivr" && channel !== "sms") {
    throw new Error("unsupported_parity_channel:" + channel);
  }
  if (typeof executeCanonicalCommand !== "function") {
    throw new Error("executeCanonicalCommand is required");
  }

  return Object.freeze({
    channel,
    async invoke(request) {
      const workflow = getWorkflowDefinition(request.workflowId);
      const support = workflow.support[channel];

      if (support === "staff-transfer" || support === "not-applicable") {
        return routeFallback({
          channel,
          workflow,
          request,
          createSecureLink: undefined,
          requestStaffTransfer,
          reason: workflow.reason ?? "staff_assistance_required",
        });
      }

      if (support === "secure-link") {
        return routeFallback({
          channel,
          workflow,
          request,
          createSecureLink,
          requestStaffTransfer,
          reason: workflow.reason ?? "secure_visual_handoff_required",
        });
      }

      const result = await executeCanonicalCommand({
        workflowId: workflow.id,
        command: workflow.command,
        actor: request.actor,
        campgroundId: request.campgroundId,
        input: request.input ?? {},
        context: request.context ?? {},
        channel,
        support,
        requiresVerification: Boolean(workflow.requiresVerification),
      });

      if (result?.requiresVisualStep) {
        return routeFallback({
          channel,
          workflow,
          request,
          createSecureLink,
          requestStaffTransfer,
          reason: result.visualReason ?? "canonical_command_requires_visual_step",
        });
      }

      return {
        kind: "canonical-command",
        workflowId: workflow.id,
        channel,
        support,
        command: workflow.command,
        result,
      };
    },
  });
}

export function createIvrWorkflowAdapter(dependencies) {
  return createWorkflowAdapter({ channel: "ivr", ...dependencies });
}

export function createSmsWorkflowAdapter(dependencies) {
  return createWorkflowAdapter({ channel: "sms", ...dependencies });
}

export function getWorkflowParityHealth() {
  const byAudience = { guest: 0, staff: 0, management: 0 };
  const byChannel = {
    web: Object.fromEntries(SUPPORT_LEVELS.map((level) => [level, 0])),
    ivr: Object.fromEntries(SUPPORT_LEVELS.map((level) => [level, 0])),
    sms: Object.fromEntries(SUPPORT_LEVELS.map((level) => [level, 0])),
  };
  let graphicalOnly = 0;

  for (const workflow of workflowParityMatrix) {
    if (workflow.audience in byAudience) {
      byAudience[workflow.audience] += 1;
    }
    if (workflow.visualOnly) {
      graphicalOnly += 1;
    }
    for (const channel of CHANNELS) {
      byChannel[channel][workflow.support[channel]] += 1;
    }
  }

  return Object.freeze({
    status: "ready",
    workflows: workflowParityMatrix.length,
    canonicalCommands: new Set(
      workflowParityMatrix.map((workflow) => workflow.command),
    ).size,
    graphicalOnly,
    byAudience: Object.freeze(byAudience),
    byChannel: Object.freeze({
      web: Object.freeze(byChannel.web),
      ivr: Object.freeze(byChannel.ivr),
      sms: Object.freeze(byChannel.sms),
    }),
    safeguards: Object.freeze({
      canonicalDomainCommandsOnly: true,
      visualStepsUseHandoff: true,
      staffFallbackAvailable: true,
      callerOrSenderHintIsAuthentication: false,
    }),
  });
}

assertWorkflowParityRegistry();
