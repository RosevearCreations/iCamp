import { SectionHeading } from "@/components/section-heading";
import type { CottageHousekeepingState } from "@/lib/housekeeping/postgres.mjs";

import {
  addCottageInventoryChecklistItemAction,
  createCottageHousekeepingTemplateAction,
  createCottageTurnoverAction,
  recordCottageDamageInspectionAction,
  recordCottageTurnoverItemCheckAction,
} from "./actions";
import styles from "./accommodation-admin.module.css";

function formatDate(value: string | Date | null) {
  if (!value) {
    return "Not yet";
  }
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export function HousekeepingPanel({
  campgroundId,
  accommodationId,
  canManage,
  state,
}: Readonly<{
  campgroundId: string;
  accommodationId: string;
  canManage: boolean;
  state: CottageHousekeepingState | undefined;
}>) {
  const templates = state?.templates ?? [];
  const turnovers = state?.turnovers ?? [];
  const openTurnovers = turnovers.filter(
    (turnover) => !["ready", "cancelled"].includes(turnover.status),
  );

  return (
    <div className={styles.housekeepingPanel}>
      <SectionHeading
        eyebrow="Build 027"
        title="Cottage turnover & housekeeping"
        id={"cottage-housekeeping-" + accommodationId}
        helpTopic="cottage.housekeeping"
      />

      <div className={styles.housekeepingSummary}>
        <div>
          <span>Active templates</span>
          <strong>
            {templates.filter((template) => template.isActive).length}
          </strong>
        </div>
        <div>
          <span>Open turnovers</span>
          <strong>{openTurnovers.length}</strong>
        </div>
        <div>
          <span>Latest readiness</span>
          <strong>
            {turnovers[0]?.status.replace("_", " ") ?? "No turnover yet"}
          </strong>
        </div>
      </div>

      {templates.length > 0 ? (
        <div className={styles.housekeepingGrid}>
          {templates.map((template) => (
            <article className={styles.housekeepingCard} key={template.id}>
              <div className={styles.housekeepingHeader}>
                <div>
                  <p className="eyebrow">
                    {template.turnoverType.replace("_", " ")}
                  </p>
                  <h4>{template.name}</h4>
                </div>
                <span className={styles.statusPill}>
                  {template.expectedMinutes} min
                </span>
              </div>

              <div className={styles.templateNotes}>
                <p>
                  <strong>Linen:</strong>{" "}
                  {template.linenRequirements ||
                    "No separate linen instruction."}
                </p>
                <p>
                  <strong>Housekeeping:</strong>{" "}
                  {template.housekeepingRequirements ||
                    "No separate housekeeping instruction."}
                </p>
                <p>
                  Damage inspection{" "}
                  {template.damageInspectionRequired ? "required" : "optional"}{" "}
                  · security inspection{" "}
                  {template.securityInspectionRequired
                    ? "required"
                    : "optional"}
                </p>
              </div>

              <div className={styles.checklist}>
                <strong>Inventory checklist</strong>
                {template.items.length > 0 ? (
                  template.items.map((item) => (
                    <div className={styles.checklistItem} key={item.id}>
                      <span>{item.category}</span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.requiredQuantity} {item.unit}
                        {item.expectedCondition
                          ? " · " + item.expectedCondition
                          : ""}
                        {item.isRequired ? " · required" : ""}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className={styles.boundary}>
                    No inventory checklist items yet.
                  </p>
                )}
              </div>

              {canManage ? (
                <>
                  <form
                    action={addCottageInventoryChecklistItemAction}
                    className={styles.compactForm}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <label className={styles.field}>
                      <span>Category</span>
                      <select name="category" defaultValue="linen">
                        <option value="linen">Linen</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="bathroom">Bathroom</option>
                        <option value="safety">Safety</option>
                        <option value="security">Security</option>
                        <option value="equipment">Equipment</option>
                        <option value="consumable">Consumable</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Item</span>
                      <input name="name" maxLength={160} required />
                    </label>
                    <label className={styles.field}>
                      <span>Quantity</span>
                      <input
                        name="requiredQuantity"
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={1}
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Unit</span>
                      <input
                        name="unit"
                        maxLength={32}
                        defaultValue="item"
                        required
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Condition</span>
                      <input name="expectedCondition" maxLength={500} />
                    </label>
                    <label className={styles.field}>
                      <span>Sort</span>
                      <input
                        name="sortOrder"
                        type="number"
                        min={0}
                        defaultValue={10}
                      />
                    </label>
                    <label className={styles.inlineCheck}>
                      <input type="checkbox" name="isRequired" defaultChecked />
                      Required
                    </label>
                    <button className="primary-button" type="submit">
                      Add checklist item
                    </button>
                  </form>

                  <form
                    action={createCottageTurnoverAction}
                    className={styles.turnoverLaunch}
                  >
                    <input
                      type="hidden"
                      name="campgroundId"
                      value={campgroundId}
                    />
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <label className={styles.field}>
                      <span>Turnover note</span>
                      <input
                        name="notes"
                        maxLength={2000}
                        placeholder="Optional departure or readiness note"
                      />
                    </label>
                    <button className="primary-button" type="submit">
                      Start turnover from template
                    </button>
                  </form>
                </>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.boundary}>
          No turnover template exists for this cottage yet.
        </p>
      )}

      {canManage ? (
        <form
          action={createCottageHousekeepingTemplateAction}
          className={styles.housekeepingCreate}
        >
          <input type="hidden" name="campgroundId" value={campgroundId} />
          <input type="hidden" name="accommodationId" value={accommodationId} />
          <label className={styles.field}>
            <span>Template name</span>
            <input
              name="name"
              maxLength={120}
              placeholder="Standard departure"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Turnover type</span>
            <select name="turnoverType" defaultValue="departure">
              <option value="departure">Departure</option>
              <option value="deep_clean">Deep clean</option>
              <option value="winter_open">Winter open</option>
              <option value="winter_close">Winter close</option>
              <option value="maintenance_reset">Maintenance reset</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Expected minutes</span>
            <input
              name="expectedMinutes"
              type="number"
              min={5}
              max={1440}
              defaultValue={90}
              required
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Linen requirements</span>
            <textarea
              name="linenRequirements"
              maxLength={2000}
              rows={3}
              placeholder="Bedding, towels, mattress protectors..."
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Housekeeping requirements</span>
            <textarea
              name="housekeepingRequirements"
              maxLength={4000}
              rows={3}
              placeholder="Kitchen, washroom, floors, surfaces, garbage..."
            />
          </label>
          <div className={styles.checkGrid}>
            <label>
              <input
                type="checkbox"
                name="damageInspectionRequired"
                defaultChecked
              />
              Damage inspection
            </label>
            <label>
              <input
                type="checkbox"
                name="securityInspectionRequired"
                defaultChecked
              />
              Security inspection
            </label>
          </div>
          <div className={styles.actions}>
            <button className="primary-button" type="submit">
              Create turnover template
            </button>
          </div>
        </form>
      ) : null}

      <div className={styles.turnoverList}>
        <div className={styles.housekeepingHeader}>
          <div>
            <p className="eyebrow">Operational runs</p>
            <h4>Recent cottage turnovers</h4>
          </div>
          <span className={styles.statusPill}>{turnovers.length} shown</span>
        </div>

        {turnovers.length > 0 ? (
          turnovers.map((turnover) => (
            <article className={styles.turnoverCard} key={turnover.id}>
              <div className={styles.housekeepingHeader}>
                <div>
                  <strong>{turnover.status.replace("_", " ")}</strong>
                  <p>Scheduled {formatDate(turnover.scheduledFor)}</p>
                </div>
                <span className={styles.statusPill}>
                  {turnover.itemChecks.filter((item) => item.checked).length}/
                  {turnover.itemChecks.length} checked
                </span>
              </div>

              {turnover.blockedReason ? (
                <p className={styles.blockedReason}>{turnover.blockedReason}</p>
              ) : null}

              <div className={styles.checklist}>
                {turnover.itemChecks.length > 0 ? (
                  turnover.itemChecks.map((item) => (
                    <div className={styles.turnoverCheck} key={item.id}>
                      <div>
                        <span>{item.category}</span>
                        <strong>
                          {item.checked ? "✓ " : ""}
                          {item.name}
                        </strong>
                        <small>
                          {item.requiredQuantity} {item.unit}
                          {item.issueFound ? " · ISSUE" : ""}
                        </small>
                      </div>
                      {canManage &&
                      !["ready", "cancelled"].includes(turnover.status) ? (
                        <form
                          action={recordCottageTurnoverItemCheckAction}
                          className={styles.checkAction}
                        >
                          <input
                            type="hidden"
                            name="campgroundId"
                            value={campgroundId}
                          />
                          <input
                            type="hidden"
                            name="turnoverId"
                            value={turnover.id}
                          />
                          <input type="hidden" name="checkId" value={item.id} />
                          <label className={styles.inlineCheck}>
                            <input
                              type="checkbox"
                              name="issueFound"
                              defaultChecked={item.issueFound}
                            />
                            Issue
                          </label>
                          <input
                            name="notes"
                            maxLength={1000}
                            defaultValue={item.notes}
                            placeholder="Optional note"
                          />
                          <button className="primary-button" type="submit">
                            {item.checked ? "Recheck" : "Check"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className={styles.boundary}>
                    This turnover has no checklist snapshot.
                  </p>
                )}
              </div>

              {canManage && turnover.status !== "cancelled" ? (
                <form
                  action={recordCottageDamageInspectionAction}
                  className={styles.inspectionForm}
                >
                  <input
                    type="hidden"
                    name="campgroundId"
                    value={campgroundId}
                  />
                  <input type="hidden" name="turnoverId" value={turnover.id} />
                  <div className={styles.checkGrid}>
                    <label>
                      <input type="checkbox" name="linenComplete" />
                      Linen complete
                    </label>
                    <label>
                      <input type="checkbox" name="housekeepingComplete" />
                      Housekeeping complete
                    </label>
                    <label>
                      <input type="checkbox" name="damageFound" />
                      Damage found
                    </label>
                    <label>
                      <input type="checkbox" name="securityIssueFound" />
                      Security issue
                    </label>
                  </div>
                  <label className={styles.fieldWide}>
                    <span>Damage notes</span>
                    <textarea name="damageNotes" rows={2} maxLength={2000} />
                  </label>
                  <label className={styles.fieldWide}>
                    <span>Security notes</span>
                    <textarea name="securityNotes" rows={2} maxLength={2000} />
                  </label>
                  <button className="primary-button" type="submit">
                    Record readiness inspection
                  </button>
                </form>
              ) : null}

              {turnover.inspections[0] ? (
                <p className={styles.boundary}>
                  Latest inspection:{" "}
                  {turnover.inspections[0].result.replace("_", " ")} ·{" "}
                  {formatDate(turnover.inspections[0].inspectedAt)}
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <p className={styles.boundary}>
            No turnover run has been started for this cottage.
          </p>
        )}
      </div>

      <p className={styles.boundary}>
        Build 027 records readiness operations and advances the shared
        accommodation revision hooks. Build 030 owns the detailed accommodation
        status engine; Build 034 remains authoritative for reservation
        compatibility and booking decisions.
      </p>
    </div>
  );
}
