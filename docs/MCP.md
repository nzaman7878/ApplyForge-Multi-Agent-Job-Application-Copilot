# ApplyForge Model Context Protocol (MCP) Specification

[← Back to Documentation Hub](README.md) • [Architecture](ARCHITECTURE.md) • [Integrations](INTEGRATIONS.md) • [API Reference](API.md)

---

## 1. Overview & Objectives

The **Model Context Protocol (MCP)** is an open standard that enables AI models and autonomous agents to securely access external tools, database resources, and system contexts. 

ApplyForge incorporates MCP architecture in two primary dimensions:
1. **Agent-to-Data Tooling**: How ApplyForge's internal LangGraph agents interface with structured database engines (e.g. Neon PostgreSQL, MongoDB) and document parsers via standardized tool calls.
2. **ApplyForge as an MCP Server**: Exposing ApplyForge capabilities as an MCP server so external AI IDEs (Antigravity, Cursor, Claude Code) and autonomous workflows can query job tracking CRM data, trigger tailoring runs, and inspect candidate fit scores directly.

```mermaid
graph LR
    subgraph Host ["AI Host / IDE Environment"]
        Agent["Antigravity / AI Agent"]
    end

    subgraph Protocol ["Model Context Protocol (MCP) Boundary"]
        Client["MCP Client"]
        Server["ApplyForge MCP Server"]
    end

    subgraph Core ["ApplyForge Platform"]
        API["ApplyForge REST API Gateway"]
        Pipeline["Multi-Agent LangGraph Engine"]
        CRM["Application Tracker CRM"]
    end

    Agent --> Client
    Client <-->|JSON-RPC 2.0 (stdio / SSE)| Server
    Server --> API
    API --> Pipeline
    API --> CRM
```

---

## 2. ApplyForge MCP Server Tools Specification

When running as an MCP server, ApplyForge exposes the following standardized tools:

### 2.1 `applyforge_tailor_resume`
Triggers the multi-agent tailoring DAG for a candidate's resume against a targeted job description.

- **Parameters**:
  - `resumeId` (`string`, required): Unique identifier of the uploaded candidate resume.
  - `jdId` (`string`, required): Identifier of the target job description.
  - `tone` (`string`, optional): Target narrative tone (`'assertive'`, `'collaborative'`, `'technical'`, `'executive'`).
- **Returns**: Formatted JSON containing tailored bullets, reasoning diffs, cover letter, and ATS keyword report.

### 2.2 `applyforge_score_ats`
Performs standalone heuristic and semantic ATS keyword fit analysis between a resume and JD.

- **Parameters**:
  - `resumeText` (`string`, required): Raw or parsed resume text.
  - `jdText` (`string`, required): Full job description text.
- **Returns**: Weighted ATS compatibility score (0–100), matched keywords by importance tier (`required`, `preferred`, `bonus`), and missing keyword gap analysis.

### 2.3 `applyforge_get_applications`
Queries the candidate's personal CRM pipeline for active job applications.

- **Parameters**:
  - `status` (`string`, optional): Filter by stage (`'wishlist'`, `'applied'`, `'interviewing'`, `'offer'`, `'rejected'`).
  - `limit` (`number`, optional): Max items to return (default: 20).
- **Returns**: List of applications with current status, company, role, fit score, and next follow-up dates.

### 2.4 `applyforge_draft_followup`
Generates a context-calibrated recruiter outreach email draft for an existing application.

- **Parameters**:
  - `applicationId` (`string`, required): The target application ID.
  - `daysElapsed` (`number`, optional): Days since submission (overrides automatic calculation).
  - `tone` (`string`, optional): `'enthusiastic'`, `'professional'`, `'direct'`.
- **Returns**: Recommended timing strategy, email subject line, and customized body text.

---

## 3. ApplyForge MCP Resources

MCP Resources allow agents to read persistent candidate assets via URI lookups:

| Resource URI Scheme | Description | MIME Type |
| :--- | :--- | :--- |
| `applyforge://applications/{id}` | Read full application dossier, CRM stage history, and tailored notes. | `application/json` |
| `applyforge://resumes/{id}` | Read parsed resume career profile (contact, skills, experience, education). | `application/json` |
| `applyforge://analytics/summary` | Read real-time KPI metrics, velocity trend, and callback rate distribution. | `application/json` |

---

## 4. MCP Server Implementation Reference

An example lightweight MCP server bridge implemented in Node.js:

```javascript
// tools/applyforge-mcp-server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_BASE = process.env.APPLYFORGE_API_URL || 'http://localhost:5000/api';
const API_TOKEN = process.env.APPLYFORGE_API_TOKEN;

const server = new Server({
  name: 'applyforge-mcp-server',
  version: '1.2.0',
}, {
  capabilities: { tools: {}, resources: {} },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'applyforge_score_ats',
      description: 'Scores resume text against a target job description',
      inputSchema: {
        type: 'object',
        properties: {
          resumeText: { type: 'string' },
          jdText: { type: 'string' },
        },
        required: ['resumeText', 'jdText'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'applyforge_score_ats') {
    const { resumeText, jdText } = request.params.arguments;
    // Execute ATS analysis logic...
    return {
      content: [{ type: 'text', text: JSON.stringify({ score: 88, matched: ['React', 'Node.js'] }) }],
    };
  }
  throw new Error(`Tool not found: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

## 5. Security & Isolation

- **Authentication Guard**: All incoming MCP tool requests must provide a valid ApplyForge API token.
- **Tenant Isolation**: Operations are restricted strictly to candidate records belonging to the authenticated token.
- **Zero Prompt Injection**: Document contents returned via MCP resources are sanitized to prevent jailbreak or injection instructions from compromising host agents.

---

*ApplyForge &copy; 2026. Document revision 1.2.0.*
