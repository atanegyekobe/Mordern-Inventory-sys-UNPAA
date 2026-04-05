const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define(
    "SLAJobRun",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      triggerSource: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "scheduler",
      },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "success",
      },
      durationMs: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      finishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      results: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      instanceId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
    },
    {
      tableName: "sla_job_runs",
      underscored: true,
    }
  );
