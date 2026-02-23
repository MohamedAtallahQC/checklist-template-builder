import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create Permissions
  const permissions = [
    // Users
    { resource: 'users', action: 'create', description: 'Create new users' },
    { resource: 'users', action: 'read', description: 'View users' },
    { resource: 'users', action: 'update', description: 'Update users' },
    { resource: 'users', action: 'delete', description: 'Delete users' },
    // Roles
    { resource: 'roles', action: 'create', description: 'Create new roles' },
    { resource: 'roles', action: 'read', description: 'View roles' },
    { resource: 'roles', action: 'update', description: 'Update roles' },
    { resource: 'roles', action: 'delete', description: 'Delete roles' },
    // Projects
    { resource: 'projects', action: 'create', description: 'Create new projects' },
    { resource: 'projects', action: 'read', description: 'View projects' },
    { resource: 'projects', action: 'update', description: 'Update projects' },
    { resource: 'projects', action: 'delete', description: 'Delete projects' },
    // Folders
    { resource: 'folders', action: 'create', description: 'Create folders' },
    { resource: 'folders', action: 'read', description: 'View folders' },
    { resource: 'folders', action: 'update', description: 'Update folders' },
    { resource: 'folders', action: 'delete', description: 'Delete folders' },
    // Templates
    { resource: 'templates', action: 'create', description: 'Create templates' },
    { resource: 'templates', action: 'read', description: 'View templates' },
    { resource: 'templates', action: 'update', description: 'Update templates' },
    { resource: 'templates', action: 'delete', description: 'Delete templates' },
    // Template Types
    { resource: 'template-types', action: 'create', description: 'Create template types' },
    { resource: 'template-types', action: 'read', description: 'View template types' },
    { resource: 'template-types', action: 'update', description: 'Update template types' },
    { resource: 'template-types', action: 'delete', description: 'Delete template types' },
    // Checklist Items
    { resource: 'checklist-items', action: 'create', description: 'Create checklist items' },
    { resource: 'checklist-items', action: 'read', description: 'View checklist items' },
    { resource: 'checklist-items', action: 'update', description: 'Update checklist items' },
    { resource: 'checklist-items', action: 'delete', description: 'Delete checklist items' },
    // Invitations
    { resource: 'invitations', action: 'create', description: 'Send invitations' },
    { resource: 'invitations', action: 'read', description: 'View invitations' },
    { resource: 'invitations', action: 'delete', description: 'Revoke invitations' },
    // Audit Logs
    { resource: 'audit-logs', action: 'read', description: 'View audit logs' },
    { resource: 'audit-logs', action: 'export', description: 'Export audit logs' },
    // Reports
    { resource: 'reports', action: 'create', description: 'Generate reports' },
    { resource: 'reports', action: 'read', description: 'View reports' },
    { resource: 'reports', action: 'download', description: 'Download reports' },
    // Integrations
    { resource: 'integrations', action: 'create', description: 'Create integrations' },
    { resource: 'integrations', action: 'read', description: 'View integrations' },
    { resource: 'integrations', action: 'delete', description: 'Delete integrations' },
  ];

  console.log('Creating permissions...');
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {},
      create: permission,
    });
  }

  // Create Roles
  console.log('Creating roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Full system access with all permissions',
      isSystem: true,
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      displayName: 'User',
      description: 'Standard user with basic permissions',
      isSystem: true,
    },
  });

  // Assign all permissions to admin role
  console.log('Assigning permissions to admin role...');
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Assign basic permissions to user role
  console.log('Assigning permissions to user role...');
  const userPermissions = [
    'projects:read', 'projects:create',
    'folders:read', 'folders:create',
    'templates:read', 'templates:create', 'templates:update',
    'checklist-items:read', 'checklist-items:create', 'checklist-items:update',
    'reports:read', 'reports:create',
    'template-types:read',
    'invitations:create', 'invitations:read',
  ];

  for (const permStr of userPermissions) {
    const [resource, action] = permStr.split(':');
    const permission = await prisma.permission.findUnique({
      where: { resource_action: { resource, action } },
    });
    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: userRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Create Template Types
  console.log('Creating template types...');
  await prisma.templateType.upsert({
    where: { name: 'web_app_testing' },
    update: {},
    create: {
      name: 'web_app_testing',
      displayName: 'Web App Testing Checklist',
      description: 'Comprehensive web application testing checklist',
      icon: 'globe',
      color: '#3B82F6',
      isSystem: true,
      schema: {
        fields: [
          { name: 'category', type: 'select', required: true, options: ['Functional', 'UI/UX', 'Performance', 'Security', 'Accessibility'] },
          { name: 'testCase', type: 'text', required: true, label: 'Test Case' },
          { name: 'expectedResult', type: 'text', required: true, label: 'Expected Result' },
          { name: 'priority', type: 'select', options: ['critical', 'high', 'medium', 'low'] },
          { name: 'browser', type: 'multiselect', options: ['chrome', 'firefox', 'safari', 'edge'] },
        ],
      },
      defaultColumns: ['category', 'testCase', 'priority', 'status'],
    },
  });

  await prisma.templateType.upsert({
    where: { name: 'mobile_app_testing' },
    update: {},
    create: {
      name: 'mobile_app_testing',
      displayName: 'Mobile App Testing Checklist',
      description: 'Mobile application testing checklist for iOS and Android',
      icon: 'smartphone',
      color: '#10B981',
      isSystem: true,
      schema: {
        fields: [
          { name: 'platform', type: 'select', options: ['ios', 'android', 'both'], required: true },
          { name: 'testCase', type: 'text', required: true, label: 'Test Case' },
          { name: 'expectedResult', type: 'text', required: true, label: 'Expected Result' },
          { name: 'deviceType', type: 'select', options: ['phone', 'tablet'] },
          { name: 'osVersion', type: 'text', label: 'OS Version' },
        ],
      },
      defaultColumns: ['platform', 'testCase', 'deviceType', 'status'],
    },
  });

  await prisma.templateType.upsert({
    where: { name: 'test_case_list' },
    update: {},
    create: {
      name: 'test_case_list',
      displayName: 'Test Case List',
      description: 'General test case management template',
      icon: 'list-checks',
      color: '#8B5CF6',
      isSystem: true,
      schema: {
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'richtext' },
          { name: 'preconditions', type: 'text' },
          { name: 'steps', type: 'array', itemType: 'text' },
          { name: 'expectedResult', type: 'text', required: true, label: 'Expected Result' },
          { name: 'priority', type: 'select', options: ['critical', 'high', 'medium', 'low'] },
        ],
      },
      defaultColumns: ['title', 'priority', 'status'],
    },
  });

  const feedbackType = await prisma.templateType.upsert({
    where: { name: 'feedback' },
    update: {},
    create: {
      name: 'feedback',
      displayName: 'Feedback & Surveys',
      description: 'Templates for gathering feedback',
      icon: 'message-square',
      color: '#F59E0B',
      isSystem: true,
      schema: {
        fields: [
          { name: 'question', type: 'text', required: true },
          { name: 'responseType', type: 'select', options: ['text', 'rating', 'boolean'] },
          { name: 'category', type: 'text' },
        ],
      },
      defaultColumns: ['question', 'category'],
    },
  });

  // Create default admin user
  console.log('Creating default admin user...');
  const passwordHash = await bcrypt.hash('Admin@123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@checklist.local' },
    update: {},
    create: {
      email: 'admin@checklist.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      status: UserStatus.active,
      emailVerifiedAt: new Date(),
    },
  });

  // Assign admin role to admin user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // Create System Templates Project
  console.log('Creating System Templates project...');
  const systemProject = await prisma.project.upsert({
    where: { slug: 'system-templates' },
    update: {},
    create: {
      name: 'System Templates',
      slug: 'system-templates',
      description: 'Container for default system templates',
      createdBy: adminUser.id,
      isArchived: false,
    },
  });

  // Create Default Templates
  console.log('Creating default templates...');

  // 1. Web App Testing Checklist
  const webAppType = await prisma.templateType.findUnique({ where: { name: 'web_app_testing' } });
  if (webAppType) {
    await prisma.template.upsert({
      where: { id: 'default-web-app-template' },
      update: {},
      create: {
        id: 'default-web-app-template',
        name: 'Web App Testing Checklist',
        description: 'Standard checklist for validating web applications before release.',
        templateTypeId: webAppType.id,
        projectId: systemProject.id,
        folderId: undefined,
        createdBy: adminUser.id,
        settings: {},
        columnConfig: [],
      }
    });

    // Add checklist items for Web App Testing
    if (webAppType) {
      const webAppTemplate = await prisma.template.findUnique({ where: { id: 'default-web-app-template' } });
      if (webAppTemplate) {
        const checklistItems = [
          // Functional Testing
          { category: 'Functional Testing', content: 'Verify all features work as per requirements' },
          { category: 'Functional Testing', content: 'Check input validation for forms (text, numbers, special characters)' },
          { category: 'Functional Testing', content: 'Test boundary and edge cases' },
          { category: 'Functional Testing', content: 'Verify navigation links/buttons redirect correctly' },
          { category: 'Functional Testing', content: 'Confirm data is saved correctly after operations (create/update/delete)' },
          { category: 'Functional Testing', content: 'Check user permissions and roles are enforced' },
          { category: 'Functional Testing', content: 'Test integration points between modules' },

          // API Testing
          { category: 'API Testing', content: 'Verify endpoint returns correct status codes (200, 400, 401, 500, etc.)' },
          { category: 'API Testing', content: 'Validate response structure and data types' },
          { category: 'API Testing', content: 'Check mandatory and optional parameters' },
          { category: 'API Testing', content: 'Test boundary and edge cases for input' },
          { category: 'API Testing', content: 'Verify error messages for invalid requests' },
          { category: 'API Testing', content: 'Confirm data consistency in the database' },
          { category: 'API Testing', content: 'Test authentication and authorization mechanisms' },

          // Database Testing
          { category: 'Database Testing', content: 'Check data integrity after CRUD operations' },
          { category: 'Database Testing', content: 'Verify relationships and foreign key constraints' },
          { category: 'Database Testing', content: 'Confirm data types, formats, and constraints are correct' },
          { category: 'Database Testing', content: 'Test stored procedures, triggers, and functions' },
          { category: 'Database Testing', content: 'Check data migration/import scripts' },
          { category: 'Database Testing', content: 'Validate indexes and performance of queries' },
          { category: 'Database Testing', content: 'Ensure rollback and recovery mechanisms work' },

          // UI/UX Testing
          { category: 'UI/UX Testing', content: 'Check layout consistency across pages' },
          { category: 'UI/UX Testing', content: 'Verify alignment of buttons, forms, and labels' },
          { category: 'UI/UX Testing', content: 'Check font styles, sizes, and colors match design' },
          { category: 'UI/UX Testing', content: 'Verify responsive design on mobile, tablet, and desktop' },
          { category: 'UI/UX Testing', content: 'Ensure icons and images render correctly' },
          { category: 'UI/UX Testing', content: 'Test hover, focus, and click states of UI elements' },
          { category: 'UI/UX Testing', content: 'Check color contrast and readability' },
          { category: 'UI/UX Testing', content: 'Verify tooltips, error messages, and notifications' },

          // Security Testing
          { category: 'Security Testing', content: 'Test authentication and authorization flows' },
          { category: 'Security Testing', content: 'Validate password policies and encryption' },
          { category: 'Security Testing', content: 'Check SQL injection, XSS, CSRF vulnerabilities' },
          { category: 'Security Testing', content: 'Verify session management (timeout, logout)' },
          { category: 'Security Testing', content: 'Test API endpoint access control' },
          { category: 'Security Testing', content: 'Confirm sensitive data is not exposed in logs or responses' },
          { category: 'Security Testing', content: 'Ensure secure communication (HTTPS, SSL/TLS)' },

          // Performance Testing
          { category: 'Performance Testing', content: 'Page load time within acceptable limits (e.g., <3 sec)' },
          { category: 'Performance Testing', content: 'Stress and load testing for peak users' },
          { category: 'Performance Testing', content: 'Memory and CPU usage within expected limits' },
          { category: 'Performance Testing', content: 'Response time for API calls acceptable' },
          { category: 'Performance Testing', content: 'Verify caching, lazy loading, and performance optimizations' },
          { category: 'Performance Testing', content: 'Check application behavior under slow network conditions' },
          { category: 'Performance Testing', content: 'Test offline mode (if applicable)' },

          // Accessibility & Compatibility
          { category: 'Accessibility & Compatibility', content: 'Verify screen reader support' },
          { category: 'Accessibility & Compatibility', content: 'Check keyboard navigation' },
          { category: 'Accessibility & Compatibility', content: 'Validate color contrast and text size options' },
          { category: 'Accessibility & Compatibility', content: 'Test application on multiple browsers (Chrome, Firefox, Safari, Edge)' },
          { category: 'Accessibility & Compatibility', content: 'Test on multiple devices and screen sizes' },
          { category: 'Accessibility & Compatibility', content: 'Ensure language/locale support (if multi-language)' },
        ];

        for (let i = 0; i < checklistItems.length; i++) {
          await prisma.checklistItem.upsert({
            where: { id: `web-app-item-${i + 1}` },
            update: {},
            create: {
              id: `web-app-item-${i + 1}`,
              templateId: webAppTemplate.id,
              position: i,
              content: {
                category: checklistItems[i].category,
                testCase: checklistItems[i].content,
                status: 'pending',
              },
              createdBy: adminUser.id,
            },
          });
        }
      }
    }
  }

  // 2. Mobile App Testing Checklist
  const mobileAppType = await prisma.templateType.findUnique({ where: { name: 'mobile_app_testing' } });
  if (mobileAppType) {
    await prisma.template.upsert({
      where: { id: 'default-mobile-app-template' },
      update: {},
      create: {
        id: 'default-mobile-app-template',
        name: 'Mobile App Testing Checklist',
        description: ' comprehensive checklist for iOS and Android mobile app verification.',
        templateTypeId: mobileAppType.id,
        projectId: systemProject.id,
        folderId: undefined,
        createdBy: adminUser.id,
        settings: {},
        columnConfig: [],
      }
    });
  }

  // 3. Test Case Template
  const testCaseType = await prisma.templateType.findUnique({ where: { name: 'test_case_list' } });
  if (testCaseType) {
    await prisma.template.upsert({
      where: { id: 'default-test-case-template' },
      update: {},
      create: {
        id: 'default-test-case-template',
        name: 'Test Case Template',
        description: 'General purpose template for managing test cases.',
        templateTypeId: testCaseType.id,
        projectId: systemProject.id,
        folderId: undefined,
        createdBy: adminUser.id,
        settings: {},
        columnConfig: [],
      }
    });
  }

  // 4. Year-End Feedback Tracker
  if (feedbackType) {
    await prisma.template.upsert({
      where: { id: 'default-feedback-template' },
      update: {},
      create: {
        id: 'default-feedback-template',
        name: 'Year-End Feedback Tracker',
        description: 'Track feedback and performance reviews for the end of the year.',
        templateTypeId: feedbackType.id,
        projectId: systemProject.id,
        folderId: undefined,
        createdBy: adminUser.id,
        settings: {},
        columnConfig: [],
      }
    });
  }

  console.log('Database seeding completed successfully!');
  console.log('');
  console.log('Default Admin Credentials:');
  console.log('  Email: admin@checklist.local');
  console.log('  Password: Admin@123456');
  console.log('');
  console.log('Please change the password after first login.');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
