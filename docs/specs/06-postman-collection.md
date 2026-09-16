# Fan Director Studio — Postman Collection

## Overview
Complete Postman collection for testing the Fan Director Studio API. Includes all endpoints, authentication flows, request/response examples, and test scenarios for both fan and creator workflows.

---

## Collection Structure

```json
{
  "info": {
    "name": "Fan Director Studio API",
    "description": "Boutique creator commission platform API testing collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        { "name": "Register Fan" },
        { "name": "Register Creator" },
        { "name": "Login" },
        { "name": "Get Current User" },
        { "name": "Logout" }
      ]
    },
    {
      "name": "Fan Commission Workflow",
      "item": [
        { "name": "Create Commission Request" },
        { "name": "Get Request Details" },
        { "name": "List User Requests" },
        { "name": "Update Request" }
      ]
    },
    {
      "name": "AI Director",
      "item": [
        { "name": "Send Message to Director" },
        { "name": "Select Choice Card" },
        { "name": "Get Live Scene Card" }
      ]
    },
    {
      "name": "Creator Dashboard",
      "item": [
        { "name": "List Creator Requests" },
        { "name": "Get Request Detail" },
        { "name": "Approve Request" },
        { "name": "Propose Changes" },
        { "name": "Ask Question" },
        { "name": "Decline Request" }
      ]
    }
  ]
}
```

---

## Detailed Endpoint Examples

### Authentication

#### 1. Register Fan User
```
POST http://localhost:3000/v1/auth/register

Headers:
Content-Type: application/json

Body:
{
  "email": "fan@example.com",
  "password": "SecurePass123!",
  "name": "Sarah Smiles",
  "role": "fan"
}

Response (201):
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "fan@example.com",
  "name": "Sarah Smiles",
  "role": "fan",
  "creatorHandle": null,
  "profile": {
    "avatar": null,
    "bio": null
  },
  "createdAt": "2024-01-15T10:30:45Z",
  "updatedAt": "2024-01-15T10:30:45Z"
}
```

**Postman Request**:
```json
{
  "name": "Register Fan",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"email\":\"fan@example.com\",\"password\":\"SecurePass123!\",\"name\":\"Sarah Smiles\",\"role\":\"fan\"}"
    },
    "url": {
      "raw": "{{base_url}}/auth/register",
      "host": ["{{base_url}}"],
      "path": ["auth", "register"]
    }
  },
  "response": []
}
```

---

#### 2. Register Creator User
```
POST http://localhost:3000/v1/auth/register

Headers:
Content-Type: application/json

Body:
{
  "email": "maya@example.com",
  "password": "CreatorPass123!",
  "name": "Maya Atelier",
  "role": "creator",
  "creatorHandle": "maya_atelier"
}

Response (201):
{
  "id": "a87b3c5d-9e4f-4b2a-8c1d-7f6e5d4c3b2a",
  "email": "maya@example.com",
  "name": "Maya Atelier",
  "role": "creator",
  "creatorHandle": "maya_atelier",
  "profile": {
    "avatar": null,
    "bio": null
  },
  "createdAt": "2024-01-15T10:35:22Z",
  "updatedAt": "2024-01-15T10:35:22Z"
}
```

**Postman Request**:
```json
{
  "name": "Register Creator",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"email\":\"maya@example.com\",\"password\":\"CreatorPass123!\",\"name\":\"Maya Atelier\",\"role\":\"creator\",\"creatorHandle\":\"maya_atelier\"}"
    },
    "url": {
      "raw": "{{base_url}}/auth/register",
      "host": ["{{base_url}}"],
      "path": ["auth", "register"]
    }
  }
}
```

---

#### 3. Login User
```
POST http://localhost:3000/v1/auth/login

Headers:
Content-Type: application/json

Body:
{
  "email": "fan@example.com",
  "password": "SecurePass123!"
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "fan@example.com",
    "name": "Sarah Smiles",
    "role": "fan",
    "creatorHandle": null,
    "profile": {
      "avatar": null,
      "bio": null
    },
    "createdAt": "2024-01-15T10:30:45Z",
    "updatedAt": "2024-01-15T10:30:45Z"
  }
}
```

**Postman Request with Test**:
```json
{
  "name": "Login",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"email\":\"fan@example.com\",\"password\":\"SecurePass123!\"}"
    },
    "url": {
      "raw": "{{base_url}}/auth/login",
      "host": ["{{base_url}}"],
      "path": ["auth", "login"]
    }
  },
  "event": [
    {
      "listen": "test",
      "script": {
        "exec": [
          "if (pm.response.code === 200) {",
          "  var jsonData = pm.response.json();",
          "  pm.environment.set('authToken', jsonData.token);",
          "  pm.environment.set('userId', jsonData.user.id);",
          "  console.log('Token saved to environment');",
          "}"
        ]
      }
    }
  ]
}
```

---

#### 4. Get Current User
```
GET http://localhost:3000/v1/auth/me

Headers:
Authorization: Bearer {{authToken}}

Response (200):
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "fan@example.com",
  "name": "Sarah Smiles",
  "role": "fan",
  "creatorHandle": null,
  "profile": {
    "avatar": null,
    "bio": null
  },
  "createdAt": "2024-01-15T10:30:45Z",
  "updatedAt": "2024-01-15T10:30:45Z"
}
```

**Postman Request**:
```json
{
  "name": "Get Current User",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/auth/me",
      "host": ["{{base_url}}"],
      "path": ["auth", "me"]
    }
  }
}
```

---

### Fan Commission Workflow

#### 5. Create Commission Request
```
POST http://localhost:3000/v1/requests

Headers:
Authorization: Bearer {{authToken}}
Content-Type: application/json

Body:
{
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 150,
  "requestedDeliveryDate": "2024-02-15"
}

Response (201):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 150,
  "requestedDeliveryDate": "2024-02-15",
  "status": "draft",
  "estimatedTotal": null,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T10:45:30Z"
}
```

**Postman Request**:
```json
{
  "name": "Create Commission Request",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"title\":\"Vintage Lounge Greeting\",\"description\":\"Birthday message for my sister\",\"budget\":150,\"requestedDeliveryDate\":\"2024-02-15\"}"
    },
    "url": {
      "raw": "{{base_url}}/requests",
      "host": ["{{base_url}}"],
      "path": ["requests"]
    }
  },
  "event": [
    {
      "listen": "test",
      "script": {
        "exec": [
          "if (pm.response.code === 201) {",
          "  var jsonData = pm.response.json();",
          "  pm.environment.set('requestId', jsonData.id);",
          "  console.log('Request ID saved:', jsonData.id);",
          "}"
        ]
      }
    }
  ]
}
```

---

#### 6. Get Request Details
```
GET http://localhost:3000/v1/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f

Headers:
Authorization: Bearer {{authToken}}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 150,
  "requestedDeliveryDate": "2024-02-15",
  "status": "draft",
  "estimatedTotal": null,
  "sceneCard": null,
  "conversation": [],
  "timeline": null,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T10:45:30Z"
}
```

**Postman Request**:
```json
{
  "name": "Get Request Details",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/requests/{{requestId}}",
      "host": ["{{base_url}}"],
      "path": ["requests", "{{requestId}}"]
    }
  }
}
```

---

#### 7. List User Requests
```
GET http://localhost:3000/v1/requests?status=draft&sort=created_at&order=desc

Headers:
Authorization: Bearer {{authToken}}

Response (200):
{
  "data": [
    {
      "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
      "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "title": "Vintage Lounge Greeting",
      "description": "Birthday message for my sister",
      "budget": 150,
      "requestedDeliveryDate": "2024-02-15",
      "status": "draft",
      "estimatedTotal": null,
      "createdAt": "2024-01-15T10:45:30Z",
      "updatedAt": "2024-01-15T10:45:30Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "pages": 1
  }
}
```

**Postman Request**:
```json
{
  "name": "List User Requests",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/requests?status=draft&sort=created_at&order=desc",
      "host": ["{{base_url}}"],
      "path": ["requests"],
      "query": [
        {
          "key": "status",
          "value": "draft"
        },
        {
          "key": "sort",
          "value": "created_at"
        },
        {
          "key": "order",
          "value": "desc"
        }
      ]
    }
  }
}
```

---

#### 8. Update Request
```
PATCH http://localhost:3000/v1/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f

Headers:
Authorization: Bearer {{authToken}}
Content-Type: application/json

Body:
{
  "budget": 175,
  "status": "submitted"
}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 175,
  "requestedDeliveryDate": "2024-02-15",
  "status": "submitted",
  "estimatedTotal": null,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T10:50:15Z"
}
```

**Postman Request**:
```json
{
  "name": "Update Request",
  "request": {
    "method": "PATCH",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"budget\":175,\"status\":\"submitted\"}"
    },
    "url": {
      "raw": "{{base_url}}/requests/{{requestId}}",
      "host": ["{{base_url}}"],
      "path": ["requests", "{{requestId}}"]
    }
  }
}
```

---

### AI Director

#### 9. Send Message to Director
```
POST http://localhost:3000/v1/director/message

Headers:
Authorization: Bearer {{authToken}}
Content-Type: application/json

Body:
{
  "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "message": "I want a cinematic personal greeting under $150"
}

Response (200):
{
  "message": "Great! Let's create something special. I'm thinking a vintage lounge setting for an intimate, sophisticated vibe. Would you prefer a cozy evening atmosphere or something more theatrical?",
  "sceneCard": {
    "id": "s1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
    "title": "Vintage Lounge Greeting",
    "description": "Cinematic personal greeting in vintage lounge setting",
    "components": [
      {
        "id": "comp-1",
        "name": "Duration",
        "value": "3-Minute Video",
        "icon": "lucide:clock",
        "price": 90,
        "isEditable": false
      },
      {
        "id": "comp-2",
        "name": "Setting",
        "value": "Vintage Lounge Setup",
        "icon": "lucide:home",
        "price": 35,
        "isEditable": true
      }
    ],
    "lineItems": [
      {
        "id": "line-1",
        "label": "Base Video (3-min)",
        "price": 90,
        "editable": false
      },
      {
        "id": "line-2",
        "label": "Vintage Lounge Setup",
        "price": 35,
        "editable": true
      }
    ],
    "estimatedTotal": 125,
    "referenceImage": "https://example.com/vintage-lounge.jpg",
    "wardrobe": "Creator approved catalog",
    "creatorBoundaries": "All options within listed catalog",
    "createdAt": "2024-01-15T10:46:00Z",
    "updatedAt": "2024-01-15T10:46:00Z"
  },
  "suggestions": [
    "Cozy evening atmosphere",
    "More theatrical setting",
    "Intimate ambiance"
  ]
}
```

**Postman Request**:
```json
{
  "name": "Send Message to Director",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"requestId\":\"{{requestId}}\",\"message\":\"I want a cinematic personal greeting under $150\"}"
    },
    "url": {
      "raw": "{{base_url}}/director/message",
      "host": ["{{base_url}}"],
      "path": ["director", "message"]
    }
  }
}
```

---

#### 10. Select Choice Card
```
POST http://localhost:3000/v1/director/choice

Headers:
Authorization: Bearer {{authToken}}
Content-Type: application/json

Body:
{
  "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "choiceIndex": 0
}

Response (200):
{
  "id": "s1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
  "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "title": "Vintage Lounge Greeting",
  "description": "Cinematic personal greeting in vintage lounge with cozy evening atmosphere",
  "components": [
    {
      "id": "comp-1",
      "name": "Duration",
      "value": "3-Minute Video",
      "icon": "lucide:clock",
      "price": 90,
      "isEditable": false
    },
    {
      "id": "comp-2",
      "name": "Setting",
      "value": "Vintage Lounge Setup",
      "icon": "lucide:home",
      "price": 35,
      "isEditable": true
    },
    {
      "id": "comp-3",
      "name": "Atmosphere",
      "value": "Cozy Evening Lighting",
      "icon": "lucide:lightbulb",
      "price": 20,
      "isEditable": true
    }
  ],
  "lineItems": [
    {
      "id": "line-1",
      "label": "Base Video (3-min)",
      "price": 90,
      "editable": false
    },
    {
      "id": "line-2",
      "label": "Vintage Lounge Setup",
      "price": 35,
      "editable": true
    },
    {
      "id": "line-3",
      "label": "Cozy Evening Lighting",
      "price": 20,
      "editable": true
    }
  ],
  "estimatedTotal": 145,
  "referenceImage": "https://example.com/vintage-lounge-cozy.jpg",
  "wardrobe": "Creator approved catalog",
  "creatorBoundaries": "All options within listed catalog",
  "createdAt": "2024-01-15T10:46:00Z",
  "updatedAt": "2024-01-15T10:47:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Select Choice Card",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"requestId\":\"{{requestId}}\",\"choiceIndex\":0}"
    },
    "url": {
      "raw": "{{base_url}}/director/choice",
      "host": ["{{base_url}}"],
      "path": ["director", "choice"]
    }
  }
}
```

---

#### 11. Get Live Scene Card
```
GET http://localhost:3000/v1/scene/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f

Headers:
Authorization: Bearer {{authToken}}

Response (200):
{
  "id": "s1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
  "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "title": "Vintage Lounge Greeting",
  "description": "Cinematic personal greeting in vintage lounge with cozy evening atmosphere",
  "components": [...],
  "lineItems": [...],
  "estimatedTotal": 145,
  "referenceImage": "https://example.com/vintage-lounge-cozy.jpg",
  "wardrobe": "Creator approved catalog",
  "creatorBoundaries": "All options within listed catalog",
  "createdAt": "2024-01-15T10:46:00Z",
  "updatedAt": "2024-01-15T10:47:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Get Live Scene Card",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{authToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/scene/{{requestId}}",
      "host": ["{{base_url}}"],
      "path": ["scene", "{{requestId}}"]
    }
  }
}
```

---

### Creator Dashboard

#### 12. List Creator Requests
```
GET http://localhost:3000/v1/creator/requests?status=submitted&sort=created_at&page=1

Headers:
Authorization: Bearer {{creatorToken}}

Response (200):
{
  "data": [
    {
      "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
      "fanHandle": "sarah_smiles",
      "fanAvatar": "https://example.com/sarah.jpg",
      "title": "Vintage Lounge Greeting",
      "description": "Birthday message for my sister",
      "estimatedTotal": 145,
      "requestedDeliveryDate": "2024-02-15",
      "status": "submitted",
      "unrespondedQuestions": 0,
      "createdAt": "2024-01-15T10:45:30Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "pages": 1
  }
}
```

**Postman Request**:
```json
{
  "name": "List Creator Requests",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/creator/requests?status=submitted&sort=created_at&page=1",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests"],
      "query": [
        {
          "key": "status",
          "value": "submitted"
        },
        {
          "key": "sort",
          "value": "created_at"
        },
        {
          "key": "page",
          "value": "1"
        }
      ]
    }
  }
}
```

---

#### 13. Get Request Detail (Creator)
```
GET http://localhost:3000/v1/creator/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f

Headers:
Authorization: Bearer {{creatorToken}}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fan": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "name": "Sarah Smiles",
    "handle": "sarah_smiles",
    "avatar": "https://example.com/sarah.jpg"
  },
  "sceneCard": {
    "id": "s1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
    "title": "Vintage Lounge Greeting",
    "description": "Cinematic personal greeting in vintage lounge with cozy evening atmosphere",
    "components": [...],
    "lineItems": [...],
    "estimatedTotal": 145,
    "referenceImage": "https://example.com/vintage-lounge-cozy.jpg",
    "wardrobe": "Creator approved catalog",
    "creatorBoundaries": "All options within listed catalog",
    "createdAt": "2024-01-15T10:46:00Z",
    "updatedAt": "2024-01-15T10:47:00Z"
  },
  "conversation": [
    {
      "id": "msg-1",
      "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
      "sender": "fan",
      "content": "I want a cinematic personal greeting under $150",
      "suggestions": [],
      "createdAt": "2024-01-15T10:46:30Z"
    },
    {
      "id": "msg-2",
      "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
      "sender": "director",
      "content": "Great! Let's create something special...",
      "suggestions": ["Cozy evening atmosphere", "More theatrical setting"],
      "createdAt": "2024-01-15T10:47:00Z"
    }
  ],
  "status": "submitted",
  "timeline": {
    "submittedDate": "2024-01-15T10:50:00Z",
    "estimatedDeliveryDate": "2024-02-15",
    "creatorReviewTime": "24-48 hours"
  },
  "createdAt": "2024-01-15T10:45:30Z"
}
```

**Postman Request**:
```json
{
  "name": "Get Request Detail",
  "request": {
    "method": "GET",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      }
    ],
    "url": {
      "raw": "{{base_url}}/creator/requests/{{requestId}}",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests", "{{requestId}}"]
    }
  }
}
```

---

#### 14. Approve Request
```
POST http://localhost:3000/v1/creator/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f/approve

Headers:
Authorization: Bearer {{creatorToken}}
Content-Type: application/json

Body:
{
  "notes": "Beautiful request! Looking forward to bringing this to life. The vintage lounge setting with cozy evening lighting will create the perfect intimate atmosphere."
}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 175,
  "requestedDeliveryDate": "2024-02-15",
  "status": "approved",
  "estimatedTotal": 145,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Approve Request",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"notes\":\"Beautiful request! Looking forward to bringing this to life.\"}"
    },
    "url": {
      "raw": "{{base_url}}/creator/requests/{{requestId}}/approve",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests", "{{requestId}}", "approve"]
    }
  }
}
```

---

#### 15. Propose Changes
```
POST http://localhost:3000/v1/creator/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f/propose

Headers:
Authorization: Bearer {{creatorToken}}
Content-Type: application/json

Body:
{
  "changes": "The 3-minute format works great, but I'd like to suggest adding a personalized opening sequence. This would require an additional minute of video, bringing the total to 4 minutes.",
  "revisedPrice": 175,
  "revisedDeliveryDate": "2024-02-20"
}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 175,
  "requestedDeliveryDate": "2024-02-15",
  "status": "changes_requested",
  "estimatedTotal": 175,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T11:05:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Propose Changes",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"changes\":\"The 3-minute format works great, but I'd like to suggest adding a personalized opening sequence...\",\"revisedPrice\":175,\"revisedDeliveryDate\":\"2024-02-20\"}"
    },
    "url": {
      "raw": "{{base_url}}/creator/requests/{{requestId}}/propose",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests", "{{requestId}}", "propose"]
    }
  }
}
```

---

#### 16. Ask Question
```
POST http://localhost:3000/v1/creator/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f/ask

Headers:
Authorization: Bearer {{creatorToken}}
Content-Type: application/json

Body:
{
  "question": "Does your sister have a favorite color or style preference I should incorporate into the lounge setting?"
}

Response (200):
{
  "id": "q1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "requestId": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "question": "Does your sister have a favorite color or style preference I should incorporate into the lounge setting?",
  "createdAt": "2024-01-15T11:10:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Ask Question",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"question\":\"Does your sister have a favorite color or style preference I should incorporate into the lounge setting?\"}"
    },
    "url": {
      "raw": "{{base_url}}/creator/requests/{{requestId}}/ask",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests", "{{requestId}}", "ask"]
    }
  }
}
```

---

#### 17. Decline Request
```
POST http://localhost:3000/v1/creator/requests/d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f/decline

Headers:
Authorization: Bearer {{creatorToken}}
Content-Type: application/json

Body:
{
  "reason": "I'm currently at capacity with other commissions. I'd recommend reaching out again in 3 weeks when I'll have availability."
}

Response (200):
{
  "id": "d7c9e8f7-6b5a-4c3d-2e1f-0a9b8c7d6e5f",
  "fanId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Vintage Lounge Greeting",
  "description": "Birthday message for my sister",
  "budget": 175,
  "requestedDeliveryDate": "2024-02-15",
  "status": "declined",
  "estimatedTotal": 145,
  "createdAt": "2024-01-15T10:45:30Z",
  "updatedAt": "2024-01-15T11:15:00Z"
}
```

**Postman Request**:
```json
{
  "name": "Decline Request",
  "request": {
    "method": "POST",
    "header": [
      {
        "key": "Authorization",
        "value": "Bearer {{creatorToken}}"
      },
      {
        "key": "Content-Type",
        "value": "application/json"
      }
    ],
    "body": {
      "mode": "raw",
      "raw": "{\"reason\":\"I'm currently at capacity with other commissions.\"}"
    },
    "url": {
      "raw": "{{base_url}}/creator/requests/{{requestId}}/decline",
      "host": ["{{base_url}}"],
      "path": ["creator", "requests", "{{requestId}}", "decline"]
    }
  }
}
```

---

## Environment Setup

### Variables
```json
{
  "base_url": "http://localhost:3000/v1",
  "authToken": "",
  "creatorToken": "",
  "userId": "",
  "creatorId": "",
  "requestId": ""
}
```

**For Production**:
```json
{
  "base_url": "https://api.fandirectorstudio.com/v1",
  "authToken": "",
  "creatorToken": "",
  "userId": "",
  "creatorId": "",
  "requestId": ""
}
```

---

## Test Workflows

### Complete Fan Journey (Sequential)
1. Register Fan → save token as `authToken`
2. Create Request → save requestId
3. Send Message to Director
4. Select Choice Card
5. Get Live Scene Card
6. Update Request (status: submitted)

### Complete Creator Review (Sequential)
1. Register Creator → save token as `creatorToken`
2. List Creator Requests
3. Get Request Detail
4. Ask Question
5. Approve Request

### Alternative Creator Flows
- **Propose Changes**: Get Request Detail → Propose Changes
- **Decline**: Get Request Detail → Decline Request

---

## Error Test Cases

### Invalid Email Registration
```
POST {{base_url}}/auth/register
Body: {"email": "invalid-email", "password": "Pass123", "name": "Test", "role": "fan"}
Expected: 400 Bad Request
```

### Missing Required Fields
```
POST {{base_url}}/director/message
Body: {"requestId": "valid-uuid"}  // missing message
Expected: 400 Bad Request - "message is required"
```

### Unauthorized Access
```
GET {{base_url}}/auth/me
Headers: (no Authorization header)
Expected: 401 Unauthorized
```

### Not Found
```
GET {{base_url}}/requests/invalid-uuid
Headers: Authorization: Bearer {{authToken}}
Expected: 404 Not Found
```

---

## Performance Testing

### Load Test Configuration
- **Concurrency**: 10 users
- **Duration**: 60 seconds
- **Endpoints to Test**: 
  - GET /requests (list)
  - POST /director/message
  - GET /creator/requests (list)

### Sample Newman Command
```bash
newman run "Fan Director Studio API.postman_collection.json" \
  --environment "development.postman_environment.json" \
  --reporters cli,json \
  --reporter-json-export "results.json"
```

---

## Import Instructions

1. **Download Collection**: Export this JSON as `Fan-Director-Studio-API.postman_collection.json`
2. **Download Environment**: Export variables as `development.postman_environment.json`
3. **Import in Postman**:
   - Open Postman
   - Click "Import" (top-left)
   - Select both files
   - Collection and environment appear in sidebar
4. **Run Requests**: Select environment, click any request, hit "Send"
5. **Authenticate**: Run "Login" first to populate `authToken`
