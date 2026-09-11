'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("SystemSettings", {
      key: {
        type: Sequelize.STRING(80),
        primaryKey: true,
      },
      value: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("SystemSettings");
  }
};
