---

# **Firestore Security Rules: Architectural Philosophy & Standard**

## **1. Document Purpose**

This document is the canonical source of truth for the **philosophy, principles, and patterns** used to write all Firestore Security Rules. Its purpose is to ensure that our rules are not only secure but also clear, maintainable, and easy to debug.

## **2. The Core Philosophy: Deny by Default**

Our entire security model is built on the principle of **"Deny by Default."** Firestore is a locked-down fortress by default. Our rules are not written to _block_ malicious actions; they are written to _explicitly permit_ only the precise, well-defined actions that a legitimate user needs to perform. If a request does not perfectly match a specific `allow` statement, it is automatically and silently rejected.

Every rule we write is a key that unlocks one specific door. If there is no key for a door, it remains locked forever.

## **3. The Three Guiding Principles**

All security rules **MUST** be written in accordance with the following three architectural principles.

### **Principle 1: The Principle of Explicit Intent**

_The "Why" Must Be Obvious From the Code._

A security rule is not a place for clever, condensed code. Its primary goal is clarity. A developer must be able to read a rule and immediately understand the business logic it is enforcing.

**Mandates:**

- **A. Decompose with Functions:** All non-trivial logic **MUST** be encapsulated in a well-named helper function. A function's name must describe the business rule it represents (e.g., `isLastAdminRuleSatisfied`, not `checkAdmins`).
- **B. One Responsibility Per Function:** Each helper function **MUST** have a single, verifiable responsibility.
- **C. Assemble, Don't Obfuscate:** The final `allow` statement **MUST** be a clean composition of these helper functions. Complex chains of `&&` and `||` with inline logic are strictly forbidden. The final rule should read like a sentence describing the conditions for access.

### **Principle 2: The Principle of Data Integrity**

_Rules Are the Final Gatekeeper of Data Quality._

Security rules are not just for authentication and authorization; they are the last and most important line of defense against corrupted or invalid data being written to the database. The client can have bugs, but the rules must be absolute.

**Mandates:**

- **A. Validate the "Write":** All `allow create` and `allow update` rules **MUST** inspect the incoming data (`request.resource.data`) to validate its shape, structure, and content against the established business logic.
- **B. Use Master Validation Functions:** For complex operations like creating a new entity, a single master function (e.g., `isValidNewGroup`) **MUST** be created that composes multiple smaller validation checks. This ensures that no new entity can be created in an invalid state.

### **Principle 3: The Principle of Non-Recursive Validation**

_A Rule Cannot Depend on the Result of Its Own Action._

The evaluation of a rule must be self-contained and must not depend on reading the very same document it is trying to grant access to. This creates an impossible paradox that Firestore will always deny.

**Mandates:**

- **A. Use `resource.data` for Self-Validation:** When writing a rule for a specific path (e.g., `match /groups/{groupId}`), any checks against the _existing_ data in that document **MUST** use the `resource.data` variable.
- **B. Forbid `get()` on the Same Path:** A rule for a path **MUST NOT** use the `get()` function to read from that same path. The `get()` function is reserved for reading _other_ documents to inform the current decision (e.g., a `/turnLog` rule reading its parent `/groups` document).

## **4. Putting It Into Practice: The Workflow**

When writing a new rule, follow this process:

1.  **State the Requirement:** In plain English, write down the conditions for the action (e.g., "A user can update a group if they are an admin, OR if they are joining for the first time, OR if they are leaving.").
2.  **Write the Building Blocks:** For each condition, write a small, dedicated helper function.
3.  **Assemble the Final Rule:** Compose your helper functions in the `allow` statement. The code should map directly to the plain-English requirement you wrote in step 1.

**Example: The `update` Rule for Groups**

```
// The Requirement: "Allow an update if the user is an admin making a valid change,
// OR if they are a new user joining, OR if they are an existing member leaving."

allow update: if isAdminMakingValidChange(groupId, request.resource.data)
              || isUserJoiningGroup(groupId, request.resource.data)
              || isUserLeavingGroup(groupId, request.resource.data);
```
