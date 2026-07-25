import { mutation, query, internalQuery, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { requireTenant, requireTenantRole, assertTenantDoc } from './authHelpers'

// ═══════════════════════════════════════════════════════════════
// Agency Branches
// ═══════════════════════════════════════════════════════════════

const PREDEFINED_BRANCHES = [
  { branchType: 'ILS', label: 'Independent Living Services', order: 0 },
  { branchType: 'SLS', label: 'Supported Living Services', order: 1 },
  { branchType: 'Daycare', label: 'Daycare', order: 2 },
]

export const listAgencyBranches = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)
    return await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.eq(q.field('active'), true))
      .order('asc')
      .collect()
  },
})

export const listAllAgencyBranches = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)
    return await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .order('asc')
      .collect()
  },
})

export const seedDefaultBranches = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    const existing = await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    if (existing.length > 0) return existing
    const created = await Promise.all(
      PREDEFINED_BRANCHES.map((b) =>
        ctx.db.insert('agencyBranches', {
          tenantId,
          branchType: b.branchType,
          label: b.label,
          isPredefined: true,
          order: b.order,
          active: true,
        }),
      ),
    )
    return created
  },
})

export const createBranch = mutation({
  args: {
    clerkOrgId: v.string(),
    branchType: v.string(),
    label: v.string(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, { clerkOrgId, branchType, label, order }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
    const existing = await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    const maxOrder = existing.reduce((max, b) => Math.max(max, b.order), -1)
    return await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType,
      label,
      isPredefined: PREDEFINED_BRANCHES.some((b) => b.branchType === branchType),
      order: order ?? maxOrder + 1,
      active: true,
    })
  },
})

export const toggleBranch = mutation({
  args: {
    clerkOrgId: v.string(),
    branchId: v.id('agencyBranches'),
    active: v.boolean(),
  },
  handler: async (ctx, { clerkOrgId, branchId, active }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
    const branch = await ctx.db.get(branchId)
    if (!branch) throw new Error('Branch not found.')
    assertTenantDoc(branch, tenantId)
    await ctx.db.patch(branchId, { active })
  },
})

// ═══════════════════════════════════════════════════════════════
// Products & Agency Product Subscriptions
// ═══════════════════════════════════════════════════════════════

const DEFAULT_PRODUCTS = [
  {
    key: 'hiring',
    label: 'Hiring Process & Onboarding',
    description: 'Candidate application, onboarding, training, and hiring flow.',
  },
  {
    key: 'full_platform',
    label: 'Full Platform',
    description: 'Hiring + shift management + documentation + scheduling + billing.',
  },
]

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('products')
      .withIndex('by_key')
      .filter((q) => q.eq(q.field('active'), true))
      .collect()
  },
})

export const listAgencyProducts = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)
    return await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .filter((q) => q.eq(q.field('active'), true))
      .collect()
  },
})

export const hasProduct = query({
  args: { clerkOrgId: v.string(), productKey: v.string() },
  handler: async (ctx, { clerkOrgId, productKey }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)
    const sub = await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant_product', (q) =>
        q.eq('tenantId', tenantId).eq('productKey', productKey),
      )
      .filter((q) => q.eq(q.field('active'), true))
      .first()
    return !!sub
  },
})

export const seedDefaultProducts = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    // Seed products if they don't exist
    for (const p of DEFAULT_PRODUCTS) {
      const existing = await ctx.db
        .query('products')
        .withIndex('by_key', (q) => q.eq('key', p.key))
        .first()
      if (!existing) {
        await ctx.db.insert('products', {
          key: p.key,
          label: p.label,
          description: p.description,
          active: true,
        })
      }
    }
    // Seed agency product subscription with 'hiring' as default
    const existingSub = await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
    if (existingSub.length === 0) {
      await ctx.db.insert('agencyProducts', {
        tenantId,
        productKey: 'hiring',
        active: true,
      })
    }
  },
})

export const setAgencyProduct = mutation({
  args: {
    clerkOrgId: v.string(),
    productKey: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, { clerkOrgId, productKey, active }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, ['org:admin'])
    const existing = await ctx.db
      .query('agencyProducts')
      .withIndex('by_tenant_product', (q) =>
        q.eq('tenantId', tenantId).eq('productKey', productKey),
      )
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { active })
    } else {
      await ctx.db.insert('agencyProducts', {
        tenantId,
        productKey,
        active,
      })
    }
  },
})

// ═══════════════════════════════════════════════════════════════
// Training Configs
// ═══════════════════════════════════════════════════════════════

export const getTrainingConfig = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenant(ctx, clerkOrgId)
    const config = await ctx.db
      .query('trainingConfigs')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    return config
  },
})

export const seedDefaultTrainingConfig = mutation({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, { clerkOrgId }) => {
    const { tenantId } = await requireTenantRole(ctx, clerkOrgId, [
      'org:admin',
      'org:hr',
    ])
    const existing = await ctx.db
      .query('trainingConfigs')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .first()
    if (existing) return existing

    return await ctx.db.insert('trainingConfigs', {
      tenantId,
      isDefault: true,
      passingScore: 70,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to Individuals Choice',
          type: 'text' as const,
          content: 'Welcome to Individuals Choice, Inc! We are a vendor of the San Andreas Regional Center, providing health services to our consumers to improve their lifestyle and life quality. Our goal is to assist individuals with intellectual disabilities in achieving their aspired goals and promote their self-esteem by providing assistance in training, care, and supervision in daily living activities. Our mission is grounded on consumer choices, individualized services, and support \u2014 a partnership and collaboration of formal and natural supports.',
          minDurationSec: 25,
          required: true,
        },
        {
          id: 'org_structure',
          title: 'Organizational Structure',
          type: 'text' as const,
          content: 'Individuals Choice, Inc operates two main programs.\n\n1. Independent Living Services (ILS): Customized instruction designed to meet the participant\'s needs, choices, and functional abilities. Planned to develop knowledge of specific tasks and learn at their own speed.\n\n2. Supported Living Services (SLS): Designed to assist with life skills such as budgeting, interpersonal and social skills, looking for employment, interviewing skills, general transportation, active life, and assistance with personal care.\n\nThe range of supported living services includes: assessment of consumer needs, assistance in finding and maintaining a home, facilitating circles of support, 24-hour emergency response system, social and daily living skills development, hiring and training of support staff, and development of work.',
          minDurationSec: 30,
          required: true,
        },
        {
          id: 'role_of_staff',
          title: 'Your Role as Support Staff',
          type: 'text' as const,
          content: 'As a support staff member, you are the eyes and ears of the team. Your key responsibilities include:\n\n- Observing and reporting changes or any atypical observations about a consumer\'s condition\n- Performing assigned tasks as outlined in the consumer\'s support plan\n- Assisting with Activities of Daily Living (ADLs) \u2014 one of your main responsibilities (bathing, caring for skin/hair/teeth, toileting, walking, etc.)\n- Supporting consumers as they progress toward their life goals\n- Promoting practices that keep individuals healthy and safe\n\nWhile the consumer\'s support plan is created by the support coordinator and program director, input from all care team members is needed and valued.\n\nExpected qualities: dedicated, creative, honest, flexible, perceptive, empathetic, cheerful, patient, tactful, respectful, adaptable, hardworking, a good communicator, a good listener, compassionate, and reliable.',
          minDurationSec: 30,
          required: true,
        },
        {
          id: 'consumer_rights',
          title: 'Consumer Rights & Professional Boundaries',
          type: 'policy' as const,
          content: 'CONSUMER RIGHTS: Every consumer has the right to be treated with consideration, respect, and full recognition of their dignity. Consumers shall receive treatment and services that are adequate, appropriate, and in compliance with federal and state laws. This includes respect for privacy, confidential treatment of records, freedom from discrimination and abuse, participation in the development of their care plan, and the right to refuse treatment after being fully informed.\n\nPROFESSIONAL BOUNDARIES: Maintain a positive, helpful relationship with consumers. Do not share personal information or use the consumer as a confidant. Keep the relationship supportive, not social. Be aware of consumer behavior in case of a disease or disorder. In case of a negative reaction, step back and re-approach later when calm. Use touch only when it serves a good purpose. Avoid terms the consumer may misconstrue. Practice good personal hygiene, dress professionally, and avoid off-color jokes, racial slurs, and profanity.\n\nHIPAA: Every employee must abide by confidentiality laws governing access, use, and dissemination of consumer information. You will sign a consent form to authorize the release of any information.',
          minDurationSec: 40,
          required: true,
        },
        {
          id: 'policies_conduct',
          title: 'Policies & Code of Conduct',
          type: 'policy' as const,
          content: 'ZERO-TOLERANCE POLICIES: Individuals Choice, Inc maintains zero-tolerance for sexual harassment (unwelcome touching, comments about appearance, displaying inappropriate images), drugs (use of illegal substances on duty), and retaliation.\n\nCOMPLIANCE: All employees must comply with program rules, policies, and local, state, and federal laws. All employees are screened for criminal conviction before working with consumers. Unlawful or unethical behavior that harms the agency\'s reputation will not be permitted.\n\nCONFLICT OF INTEREST: Do not accept, offer, or give gifts or gratuities to or from consumers. Put the program\'s interests before your own. Do not borrow money from consumers or their family members. Do not accept additional private pay work from them.\n\nCONSEQUENCES: Violating the code of conduct may result in disciplinary action, termination of employment contract, and civil/criminal charges.\n\nCAUSES FOR TERMINATION: Use of drugs/alcohol on duty, physical force or abuse, threatening behavior, insubordination, neglect or abandoning a consumer, failure to report incidents, theft, no call/no show (automatic termination), and falsifying documentation.',
          minDurationSec: 40,
          required: true,
        },
        {
          id: 'medication_procedures',
          title: 'Medication Procedures',
          type: 'text' as const,
          content: 'STORAGE: All medications (prescribed and OTC) are kept in a safe, centrally located, locked site accessible only to DSPs. Some individuals may keep medication in a locked space in their room if their physician has approved. Refrigerated medications are kept in a locked container. All medication is stored in its original container with original prescription labels.\n\nADMINISTRATION GUIDELINES: (1) Wash hands and wear gloves. (2) Remove medication from locked storage. (3) Check right medication, dose, time, route, and individual. (4) Give medication with water. (5) Watch the individual swallow. (6) Return container to locked storage.\n\nREFUSAL OR ERROR: If a consumer refuses medication or an error occurs, immediately notify the physician, page the program director, and document the incident. The program director files a written incident report to SARC within 24 hours.\n\nPRN MEDICATIONS: Contact the physician before each dose, describe symptoms, get permission, and document everything including physician directions and the individual\'s response within 1 hour.',
          minDurationSec: 35,
          required: true,
        },
        {
          id: 'emergency_procedures',
          title: 'Emergency Procedures',
          type: 'text' as const,
          content: 'FIRE: (1) Sound the alarm. (2) Get everyone out. (3) Follow escape routes. (4) Crawl if caught in smoke. (5) Test doors with the back of your hand. (6) Meet at a pre-arranged safe place. (7) Do a head count. (8) Lead staff calls 911. (9) Fire department directs all activity once on site.\n\nEARTHQUAKE (INDOORS): Drop, cover, and hold. Get under doorways, beds, tables, or desks. Protect your head. Stay away from windows and anything that could topple.\n\nEARTHQUAKE (OUTDOORS): Move away from buildings, trees, and electrical lines. Drop to the ground until shaking stops.\n\nFLOOD (INTERNAL): Notify program director, shut main water valve, shut electricity/gas if needed, evacuate consumers if necessary.\n\nFLOOD (EXTERNAL): Notify program director, secure doors with blankets and sandbags, move consumers to higher ground.\n\nDISASTER KIT: Keep a 3-day supply of non-perishable food and water (1 gallon/person/day), first aid kit with prescription medications, flashlight and radio with extra batteries, change of clothing, sanitation supplies, and special medical supplies.\n\nMEDICAL EMERGENCY: Call 911 immediately, then report to support coordinator and program director.',
          minDurationSec: 35,
          required: true,
        },
        {
          id: 'quiz',
          title: 'Knowledge Check',
          type: 'quiz' as const,
          content: JSON.stringify({
            "questions": [
                        {
                                    "question": "What is the primary mission of Individuals Choice, Inc?",
                                    "options": [
                                                "To provide medical treatment to consumers",
                                                "To assist individuals with intellectual disabilities in achieving their goals and promote self-esteem",
                                                "To operate a residential care facility",
                                                "To provide transportation services only"
                                    ],
                                    "correct": 1
                        },
                        {
                                    "question": "What does ILS stand for?",
                                    "options": [
                                                "Independent Living Services",
                                                "Integrated Life Support",
                                                "Individualized Learning System",
                                                "Inclusive Lifestyle Services"
                                    ],
                                    "correct": 0
                        },
                        {
                                    "question": "What is one of the main responsibilities of support staff?",
                                    "options": [
                                                "Creating consumer support plans independently",
                                                "Prescribing medications to consumers",
                                                "Assisting with Activities of Daily Living (ADLs)",
                                                "Managing the agency finances"
                                    ],
                                    "correct": 2
                        },
                        {
                                    "question": "Which of the following is an expected quality of a support staff?",
                                    "options": [
                                                "Assertive and dominant",
                                                "Compassionate and reliable",
                                                "Introverted and quiet",
                                                "Competitive and ambitious"
                                    ],
                                    "correct": 1
                        },
                        {
                                    "question": "What should you do if a consumer refuses medication?",
                                    "options": [
                                                "Force them to take it",
                                                "Skip the dose and say nothing",
                                                "Notify the physician immediately and document the incident",
                                                "Wait an hour and try again without telling anyone"
                                    ],
                                    "correct": 2
                        },
                        {
                                    "question": "Where should all medications be stored?",
                                    "options": [
                                                "In the consumer bedroom drawer",
                                                "In a safe, centrally located, locked site accessible only to DSPs",
                                                "In the bathroom cabinet",
                                                "In the kitchen on the counter"
                                    ],
                                    "correct": 1
                        },
                        {
                                    "question": "What is the first thing you should do in a fire emergency?",
                                    "options": [
                                                "Call your supervisor",
                                                "Pack your belongings",
                                                "Sound the alarm and get everyone out of the house",
                                                "Try to put out the fire yourself"
                                    ],
                                    "correct": 2
                        },
                        {
                                    "question": "During an earthquake while indoors, what should you do?",
                                    "options": [
                                                "Run outside immediately",
                                                "Drop, cover, and hold -- get under a table or desk",
                                                "Stand in a doorway and wait",
                                                "Get in your car and drive away"
                                    ],
                                    "correct": 1
                        },
                        {
                                    "question": "What is the policy on accepting gifts from consumers?",
                                    "options": [
                                                "Gifts are accepted if under $25",
                                                "Gifts are accepted during holidays only",
                                                "Do not accept, offer, or give gifts or gratuities to or from consumers",
                                                "Gifts are accepted if the consumer insists"
                                    ],
                                    "correct": 2
                        },
                        {
                                    "question": "How often are employees evaluated on their work performance?",
                                    "options": [
                                                "Every 30 days",
                                                "Every 6 months",
                                                "Annually",
                                                "Only during probation"
                                    ],
                                    "correct": 2
                        }
            ]
}),
          minDurationSec: 0,
          required: true,
        },
      ],
    })
  },
})


// ═══════════════════════════════════════════════════════════════
// Public agency info — no auth required, for /apply landing page
// ═══════════════════════════════════════════════════════════════

export const getPublicAgencyInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db
      .query('tenants')
      .withIndex('by_slug', (q) => q.eq('slug', slug))
      .first()
    if (!tenant) return null

    const branches = await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenant._id))
      .filter((q) => q.eq(q.field('active'), true))
      .collect()

    return {
      clerkOrgId: tenant.clerkOrgId,
      name: tenant.name,
      address: tenant.address ?? null,
      branches: branches.map((b) => ({ _id: b._id, label: b.label })),
    }
  },
})

export const listBranchesInternal = internalQuery({
  args: { tenantId: v.id('tenants') },
  handler: async (ctx, { tenantId }) => {
    return await ctx.db
      .query('agencyBranches')
      .withIndex('by_tenant', (q) => q.eq('tenantId', tenantId))
      .collect()
  },
})

export const createBranchInternal = internalMutation({
  args: {
    tenantId: v.id('tenants'),
    branchType: v.string(),
    label: v.string(),
    order: v.number(),
  },
  handler: async (ctx, { tenantId, branchType, label, order }) => {
    return await ctx.db.insert('agencyBranches', {
      tenantId,
      branchType,
      label,
      isPredefined: true,
      order,
      active: true,
    })
  },
})


